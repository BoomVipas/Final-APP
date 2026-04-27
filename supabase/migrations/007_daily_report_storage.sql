-- 007_daily_report_storage.sql
-- Public Storage bucket for daily-update photo attachments sent via LINE.
-- The bucket must be public so LINE's CDN can fetch the hero image when
-- rendering Flex Messages.
--
-- Run AFTER 001-006. Apply via Supabase Dashboard SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create the bucket (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-reports', 'daily-reports', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage RLS policies
--    Authenticated users can upload + read their own uploads. Public read is
--    handled via the bucket's public flag (LINE CDN doesn't carry a JWT).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "daily-reports authenticated upload" ON storage.objects;
CREATE POLICY "daily-reports authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'daily-reports');

DROP POLICY IF EXISTS "daily-reports public read" ON storage.objects;
CREATE POLICY "daily-reports public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'daily-reports');

DROP POLICY IF EXISTS "daily-reports authenticated delete own" ON storage.objects;
CREATE POLICY "daily-reports authenticated delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'daily-reports' AND owner = auth.uid());

-- DONE.
