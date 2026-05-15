-- 20260515170000_storage_select_policies_scoped.sql
--
-- Scope the three storage.objects SELECT policies to the caller's own
-- folder (user_avatars / channel_avatars) or owner_id (media). Without
-- a matching SELECT, Supabase Storage's upload INSERT-then-readback
-- emits a misleading 42501 "new row violates row-level security policy"
-- 403 (seen on first avatar upload after a fresh seed). Public URL
-- reads remain unaffected — they go through storage's HTTP handler
-- with bucket.public = true.
--
-- Mirrors scripts/12-buckets.sql. Idempotent via `drop policy if exists`.

DROP POLICY IF EXISTS "User Avatar is publicly accessible" ON storage.objects;
CREATE POLICY "User Avatar is publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Channel Avatar is publicly accessible" ON storage.objects;
CREATE POLICY "Channel Avatar is publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'channel_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Media files are publicly accessible" ON storage.objects;
CREATE POLICY "Media files are publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (SELECT auth.uid())::text = owner_id
  );
