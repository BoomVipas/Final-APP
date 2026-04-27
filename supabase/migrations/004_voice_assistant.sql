-- 004_voice_assistant.sql
-- Adds vector storage + conversation history for the AI Voice Assistant
-- (Workflow 17 / PDF §10.3) and the narrative_text column for the AI shift
-- handover summary (Workflow 16 / PDF §10.2).
--
-- Run AFTER 001_initial_schema.sql, 002_rls_policies.sql, 003_functions.sql.
-- Apply in the Supabase Dashboard → SQL Editor (or via `supabase db push`).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pgvector extension (required for VECTOR columns + cosine ops)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. shift_handovers.narrative_text  (Workflow 16 B1)
--    Stores the Claude-generated bilingual handover summary.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE shift_handovers
  ADD COLUMN IF NOT EXISTS narrative_text TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. prescription_embeddings
--    One row per chunked, embedded prescription. Soft-deleted on update so
--    there is never a gap window without a valid embedding (PDF §10.3.3).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES patient_prescriptions(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  chunk_text      TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding       VECTOR(1536) NOT NULL,        -- text-embedding-3-small
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat cosine index. lists≈sqrt(rows); 100 is plenty for ≤100k rows.
-- Run `ANALYZE prescription_embeddings;` after the first backfill.
CREATE INDEX IF NOT EXISTS prescription_embeddings_vector_idx
  ON prescription_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Soft-delete lookup index.
CREATE INDEX IF NOT EXISTS prescription_embeddings_active_idx
  ON prescription_embeddings (prescription_id, is_active);

-- Patient filter for match_prescriptions.
CREATE INDEX IF NOT EXISTS prescription_embeddings_patient_active_idx
  ON prescription_embeddings (patient_id)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. voice_conversations
--    transcript is an append-only JSONB array of turns:
--      [{ role: 'user' | 'assistant', text, audio_url?, ts }]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id     UUID REFERENCES shift_handovers(id) ON DELETE SET NULL,
  transcript   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voice_conversations_caregiver_idx
  ON voice_conversations (caregiver_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_voice_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voice_conversations_updated_at_trg ON voice_conversations;
CREATE TRIGGER voice_conversations_updated_at_trg
  BEFORE UPDATE ON voice_conversations
  FOR EACH ROW EXECUTE FUNCTION touch_voice_conversations_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. match_prescriptions RPC  (PDF §10.3.2 Stage B)
--    Returns the top-k active prescription chunks closest to the query
--    embedding, optionally filtered to one patient.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_prescriptions(
  query_embedding   VECTOR(1536),
  match_count       INT DEFAULT 5,
  filter_patient_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  prescription_id UUID,
  patient_id      UUID,
  chunk_text      TEXT,
  metadata        JSONB,
  similarity      FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pe.id,
    pe.prescription_id,
    pe.patient_id,
    pe.chunk_text,
    pe.metadata,
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM prescription_embeddings pe
  WHERE pe.is_active = TRUE
    AND (filter_patient_id IS NULL OR pe.patient_id = filter_patient_id)
  ORDER BY pe.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Row-level security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE prescription_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_conversations     ENABLE ROW LEVEL SECURITY;

-- Caregivers may read embeddings only for patients in their own ward.
DROP POLICY IF EXISTS prescription_embeddings_ward_read ON prescription_embeddings;
CREATE POLICY prescription_embeddings_ward_read ON prescription_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM patients p
      JOIN users    u ON u.id = auth.uid()
      WHERE p.id      = prescription_embeddings.patient_id
        AND p.ward_id = u.ward_id
    )
  );

-- Edge functions (service role) handle all writes. No client write path.
DROP POLICY IF EXISTS prescription_embeddings_service_all ON prescription_embeddings;
CREATE POLICY prescription_embeddings_service_all ON prescription_embeddings
  FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Caregivers may read / append / update only their own conversation rows.
DROP POLICY IF EXISTS voice_conversations_self_read ON voice_conversations;
CREATE POLICY voice_conversations_self_read ON voice_conversations
  FOR SELECT
  USING (caregiver_id = auth.uid());

DROP POLICY IF EXISTS voice_conversations_self_insert ON voice_conversations;
CREATE POLICY voice_conversations_self_insert ON voice_conversations
  FOR INSERT
  WITH CHECK (caregiver_id = auth.uid());

DROP POLICY IF EXISTS voice_conversations_self_update ON voice_conversations;
CREATE POLICY voice_conversations_self_update ON voice_conversations
  FOR UPDATE
  USING (caregiver_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid());

DROP POLICY IF EXISTS voice_conversations_service_all ON voice_conversations;
CREATE POLICY voice_conversations_service_all ON voice_conversations
  FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Function permissions
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION match_prescriptions(VECTOR(1536), INT, UUID)
  TO authenticated, service_role;

-- DONE.
