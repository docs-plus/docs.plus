-- =====================================================================
-- 20260513131000_fix_avatar_buckets_anon_write.sql
-- =====================================================================
-- Restricts user_avatars and channel_avatars INSERT/UPDATE/DELETE to
-- authenticated callers whose auth.uid() matches the row owner.
-- Path-prefix scoping (e.g. user_avatars/<uid>/*) is a follow-up.
-- Mirrors scripts/12-buckets.sql.
-- =====================================================================

DROP POLICY IF EXISTS "User can upload an avatar" ON storage.objects;
CREATE POLICY "User can upload an avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user_avatars' AND owner = (SELECT auth.uid()));

DROP POLICY IF EXISTS "User can update own avatar" ON storage.objects;
CREATE POLICY "User can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user_avatars' AND owner = (SELECT auth.uid()));

DROP POLICY IF EXISTS "User can delete own avatar" ON storage.objects;
CREATE POLICY "User can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user_avatars' AND owner = (SELECT auth.uid()));

DROP POLICY IF EXISTS "User can upload a channel avatar" ON storage.objects;
CREATE POLICY "User can upload a channel avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'channel_avatars' AND owner = (SELECT auth.uid()));

DROP POLICY IF EXISTS "User can update own channel avatar" ON storage.objects;
CREATE POLICY "User can update own channel avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'channel_avatars' AND owner = (SELECT auth.uid()));

DROP POLICY IF EXISTS "User can delete own channel avatar" ON storage.objects;
CREATE POLICY "User can delete own channel avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'channel_avatars' AND owner = (SELECT auth.uid()));
