-- =====================================================================
-- 20260515130000_storage_policies_path_based.sql
-- =====================================================================
-- The `owner_id = auth.uid()::text` policies from
-- 20260515120000_storage_policies_use_owner_id.sql still 403'd on
-- avatar uploads — storage server v1.54.1 doesn't reliably auto-set
-- `owner_id` either (and `owner` UUID is the same story). Both columns
-- end up NULL after a fresh upload, so any policy that checks them
-- evaluates `null = <value>` → false → "new row violates RLS policy".
--
-- Switch to path-based scoping: the file path encodes ownership via
-- the `{userId}/avatar.png` convention, and the policy parses the
-- first folder via `(storage.foldername(name))[1]`. This is Supabase's
-- canonical tutorial pattern (matches Slack/Discord/Linear/Notion's
-- own conventions) and is bulletproof against storage-column quirks
-- because the path is set explicitly by the FE.
--
-- FE coordination: `useAvatarUpload` uploads to `{userId}/avatar.png`
-- (not the legacy `public/{userId}.png`); `Config.app.profile.getAvatarURL`
-- emits the matching read URL.
--
-- Mirrors scripts/12-buckets.sql.
-- =====================================================================

-- user_avatars

DROP POLICY IF EXISTS "User can upload an avatar" ON storage.objects;
CREATE POLICY "User can upload an avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "User can update own avatar" ON storage.objects;
CREATE POLICY "User can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "User can delete own avatar" ON storage.objects;
CREATE POLICY "User can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- channel_avatars

DROP POLICY IF EXISTS "User can upload a channel avatar" ON storage.objects;
CREATE POLICY "User can upload a channel avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "User can update own channel avatar" ON storage.objects;
CREATE POLICY "User can update own channel avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'channel_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "User can delete own channel avatar" ON storage.objects;
CREATE POLICY "User can delete own channel avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'channel_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
