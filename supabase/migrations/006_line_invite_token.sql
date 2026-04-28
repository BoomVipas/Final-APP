-- 006_line_invite_token.sql
-- Replaces the 6-character "link code" flow (005_line_linking.sql) with a
-- per-contact persistent "invite token" that the family member receives by
-- scanning a QR (or tapping a deep link). The token rides inside the LINE
-- chat message so the line-webhook can recognise which contact row to link.
--
-- Safe to apply whether or not 005 was applied. Idempotent; safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tear down the 005 artifacts (no longer used).
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX    IF EXISTS family_contacts_pending_link_code_idx;
DROP FUNCTION IF EXISTS generate_family_link_code(UUID);

ALTER TABLE family_contacts
  DROP COLUMN IF EXISTS pending_link_code,
  DROP COLUMN IF EXISTS link_code_expires_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. New columns: link_token (always set, server-generated) + linked_at.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE family_contacts
  ADD COLUMN IF NOT EXISTS link_token TEXT,
  ADD COLUMN IF NOT EXISTS linked_at  TIMESTAMPTZ;

-- Backfill any rows that pre-date this migration so NOT NULL can be enforced.
UPDATE family_contacts
   SET link_token = gen_random_uuid()::text
 WHERE link_token IS NULL;

ALTER TABLE family_contacts
  ALTER COLUMN link_token SET NOT NULL,
  ALTER COLUMN link_token SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS family_contacts_link_token_key
  ON family_contacts (link_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: clients can never choose their own token.
--    On every INSERT we overwrite link_token with a fresh UUID, regardless of
--    what the client tried to send. Updates from RLS-allowed clients are not
--    intercepted (the webhook updates with service_role).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION family_contacts_assign_link_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.link_token := gen_random_uuid()::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_contacts_assign_link_token_trg ON family_contacts;
CREATE TRIGGER family_contacts_assign_link_token_trg
  BEFORE INSERT ON family_contacts
  FOR EACH ROW EXECUTE FUNCTION family_contacts_assign_link_token();

-- DONE.
