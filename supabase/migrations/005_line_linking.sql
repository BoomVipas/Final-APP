-- 005_line_linking.sql
-- Adds the LINE OA "link code" flow. A caregiver generates a short code in
-- the family-contacts screen; the family member sends that code as a chat
-- message to the PILLo LINE Official Account; the line-webhook edge function
-- looks up the row by `pending_link_code` and writes back `line_user_id`.
--
-- Apply via Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns on family_contacts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE family_contacts
  ADD COLUMN IF NOT EXISTS pending_link_code     TEXT,
  ADD COLUMN IF NOT EXISTS link_code_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linked_at             TIMESTAMPTZ;

-- Webhook lookup is by the (uppercased) code, only while still pending.
CREATE INDEX IF NOT EXISTS family_contacts_pending_link_code_idx
  ON family_contacts (pending_link_code)
  WHERE pending_link_code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: generate a fresh 6-char code for one contact (caregiver-callable).
--    Returns the code so the caregiver can show / copy it. 30-minute expiry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_family_link_code(contact_id UUID)
RETURNS TABLE (code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Unambiguous alphabet (no 0/O/1/I) so users can read it off a screen.
  alphabet  CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code  TEXT := '';
  i         INT;
  expiry    TIMESTAMPTZ := NOW() + INTERVAL '30 minutes';
BEGIN
  FOR i IN 1..6 LOOP
    new_code := new_code ||
      substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
  END LOOP;

  UPDATE family_contacts
     SET pending_link_code    = new_code,
         link_code_expires_at = expiry
   WHERE id = contact_id;

  RETURN QUERY SELECT new_code, expiry;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_family_link_code(UUID)
  TO authenticated, service_role;
