/*
  File: storage_buckets.sql
  Description: This script defines the storage buckets for a messaging application, similar to Slack.
  The buckets are designed to store different types of media: user avatars, channel avatars, and general media files.
  Each bucket has specific policies to control access and usage, ensuring secure and organized file management.

  Reference Documentation:
  - Storage Overview: https://supabase.com/docs/guides/storage
  - Storage Schema: https://supabase.com/docs/guides/storage/schema/design
  - Storage API: https://supabase.com/docs/reference/javascript/storage

  Buckets Overview:
  - 'user_avatars': For storing user profile images.
  - 'channel_avatars': For storing images representing chat channels.
  - 'media': For storing general media files related to messages.

  Idempotency:
  - storage schema persists across `DROP SCHEMA public CASCADE`, so inserts
    must guard against existing rows and policy creates against existing names.
*/

-- User Avatars Bucket Configuration
-- Purpose: Store user profile images.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}')
on conflict (id) do nothing;

-- Policies for User Avatars Bucket.
-- SELECT is scoped to the caller's own folder. Public-URL reads are
-- served by storage's HTTP handler (bucket.public = true) and don't
-- pass through this policy; the SELECT is required only so the upload
-- INSERT-then-readback succeeds (otherwise storage maps the empty
-- readback to a misleading "new row violates row-level security
-- policy" 403). Folder-scoping blocks bucket enumeration.
drop policy if exists "User Avatar is publicly accessible" on storage.objects;
create policy "User Avatar is publicly accessible" on storage.objects
    for select to authenticated using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can upload an avatar" on storage.objects;
create policy "User can upload an avatar" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can update own avatar" on storage.objects;
create policy "User can update own avatar" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can delete own avatar" on storage.objects;
create policy "User can delete own avatar" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );

-- Channel Avatars Bucket Configuration
-- Purpose: Store images for chat channels.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}')
on conflict (id) do nothing;

-- Policies for Channel Avatars Bucket
-- Channel avatars: same SELECT-for-upload-readback rationale as above.
drop policy if exists "Channel Avatar is publicly accessible" on storage.objects;
create policy "Channel Avatar is publicly accessible" on storage.objects
    for select to authenticated using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can upload a channel avatar" on storage.objects;
create policy "User can upload a channel avatar" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can update own channel avatar" on storage.objects;
create policy "User can update own channel avatar" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can delete own channel avatar" on storage.objects;
create policy "User can delete own channel avatar" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );

-- Media Files Bucket Configuration
-- Purpose: Store various media files related to messages.
-- Max File Size: 10MB (10,485,760 bytes).
-- Allowed MIME Types: explicit allowlist (keep in sync with apps/webapp chatMediaMime.ts).
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('media', 'media', false, 10485760, array[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/heic', 'image/heif',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska',
      'audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/opus',
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown',
      'application/json',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip'
    ]::text[])
on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: `{userId}/{channelId}/{uuid}.ext` — ownership + channel membership gate reads.
-- In EXISTS (FROM channels c), qualify objects.name: bare `name` binds to c.name.
drop policy if exists "Media files are publicly accessible" on storage.objects;
drop policy if exists "User can upload media files" on storage.objects;
drop policy if exists "User can update own media files" on storage.objects;
drop policy if exists "User can delete own media files" on storage.objects;
drop policy if exists "Authed can read public channel chat media" on storage.objects;
drop policy if exists "Channel members can read chat media" on storage.objects;
drop policy if exists "Anon can read public channel chat media" on storage.objects;
drop policy if exists "User can upload own channel chat media" on storage.objects;
drop policy if exists "User can update own chat media" on storage.objects;
drop policy if exists "User can delete own chat media" on storage.objects;

create policy "Channel members can read chat media" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channel_members cm
             where cm.channel_id = (storage.foldername(name))[2]
               and cm.member_id = (select auth.uid())
        )
    );

create policy "Authed can read public channel chat media" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(objects.name))[2]
               and c.type = 'PUBLIC'
        )
    );

create policy "Anon can read public channel chat media" on storage.objects
    for select to anon using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(objects.name))[2]
               and c.type = 'PUBLIC'
        )
    );

create policy "User can upload own channel chat media" on storage.objects
    for insert to authenticated with check (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
            select 1
              from public.channel_members cm
             where cm.channel_id = (storage.foldername(name))[2]
               and cm.member_id = (select auth.uid())
        )
    );

create policy "User can update own chat media" on storage.objects
    for update to authenticated using (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "User can delete own chat media" on storage.objects
    for delete to authenticated using (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
