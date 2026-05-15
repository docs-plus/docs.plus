-- =====================================================================
-- 20260515140000_storage_add_missing_select_policies.sql
-- =====================================================================
-- Restores the SELECT policies on `storage.objects` for the three
-- buckets and re-locks the path-based INSERT policy that was
-- temporarily relaxed during diagnosis.
--
-- Root cause of the persistent 403 on avatar upload: every previous
-- migration in this series declared only INSERT/UPDATE/DELETE policies
-- on `storage.objects`. The SELECT policies that `scripts/12-buckets.sql`
-- has at lines 36 / 73 / 109 were never installed in migrations and
-- aren't present in the local DB. Supabase Storage's upload path runs
-- INSERT followed by a readback (INSERT … RETURNING or a separate
-- SELECT). With no matching SELECT policy, RLS defaults to deny on the
-- readback → storage maps the empty readback to a generic
-- "new row violates row-level security policy" 403 that misleadingly
-- points at the INSERT. The INSERT itself is fine; the policy is
-- correct (path-based — verified by manual `INSERT 0 1` in psql).
--
-- This migration:
--   1. Restores the `user_avatars` INSERT policy (path-based) that was
--      temporarily permissive during diagnosis.
--   2. Adds the three SELECT policies (user_avatars / channel_avatars
--      / media) that scripts had but migrations missed.
--
-- Mirrors scripts/12-buckets.sql.
-- =====================================================================

-- 1. Restore path-based INSERT for user_avatars (relaxed during diagnosis)
DROP POLICY IF EXISTS "User can upload an avatar" ON storage.objects;
CREATE POLICY "User can upload an avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user_avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- 2. SELECT policies (missing from migration history)

DROP POLICY IF EXISTS "User Avatar is publicly accessible" ON storage.objects;
CREATE POLICY "User Avatar is publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user_avatars');

DROP POLICY IF EXISTS "Channel Avatar is publicly accessible" ON storage.objects;
CREATE POLICY "Channel Avatar is publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'channel_avatars');

DROP POLICY IF EXISTS "Media files are publicly accessible" ON storage.objects;
CREATE POLICY "Media files are publicly accessible" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media');
