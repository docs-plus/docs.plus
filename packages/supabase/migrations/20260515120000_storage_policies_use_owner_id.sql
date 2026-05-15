-- =====================================================================
-- 20260515120000_storage_policies_use_owner_id.sql
-- =====================================================================
-- Bucket policies for user_avatars / channel_avatars / media were
-- checking `owner = auth.uid()` (uuid column). Recent Supabase storage
-- versions populate `owner_id` (text) on insert, NOT `owner` — both
-- columns still exist on `storage.objects` but `owner` is the legacy
-- one and may be NULL after a fresh upload. Result: `owner = auth.uid()`
-- evaluates `null = uuid` → false → 403 "new row violates RLS policy"
-- on every user-initiated avatar upload.
--
-- Fix: switch the seven affected policies to `owner_id = auth.uid()::text`.
-- The `(select auth.uid())` wrapper is preserved per Supabase RLS perf
-- guidance (initplan-evaluated once per query instead of per row).
-- Mirrors scripts/12-buckets.sql.
-- =====================================================================

-- user_avatars

DROP POLICY IF EXISTS "User can upload an avatar" ON storage.objects;
CREATE POLICY "User can upload an avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user_avatars' AND owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "User can update own avatar" ON storage.objects;
CREATE POLICY "User can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user_avatars' AND owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "User can delete own avatar" ON storage.objects;
CREATE POLICY "User can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user_avatars' AND owner_id = (SELECT auth.uid())::text);

-- channel_avatars

DROP POLICY IF EXISTS "User can upload a channel avatar" ON storage.objects;
CREATE POLICY "User can upload a channel avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'channel_avatars' AND owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "User can update own channel avatar" ON storage.objects;
CREATE POLICY "User can update own channel avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'channel_avatars' AND owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "User can delete own channel avatar" ON storage.objects;
CREATE POLICY "User can delete own channel avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'channel_avatars' AND owner_id = (SELECT auth.uid())::text);

-- media

DROP POLICY IF EXISTS "User can update own media files" ON storage.objects;
CREATE POLICY "User can update own media files" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = owner_id AND bucket_id = 'media');

DROP POLICY IF EXISTS "User can delete own media files" ON storage.objects;
CREATE POLICY "User can delete own media files" ON storage.objects
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid())::text = owner_id AND bucket_id = 'media');
