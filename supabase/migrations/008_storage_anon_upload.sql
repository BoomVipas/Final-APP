-- 008_storage_anon_upload.sql
-- Loosens the daily-reports upload policy so the dev-auth-bypass session
-- (which authenticates as the `anon` role on the new publishable key) can
-- upload photo attachments.
--
-- ⚠️ Production hardening: when real Supabase Auth replaces the dev bypass,
--    revert this to `TO authenticated` (see 007 for the original policy).

DROP POLICY IF EXISTS "daily-reports authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "daily-reports public upload"        ON storage.objects;

CREATE POLICY "daily-reports public upload" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'daily-reports');

-- DONE.
