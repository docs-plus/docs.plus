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
-- Allowed MIME Types: JPEG, PNG, GIF, WebP. No SVG: a public bucket serves it inline (#431).
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/gif", "image/webp"}')
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;

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
-- Allowed MIME Types: JPEG, PNG, GIF, WebP. No SVG: a public bucket serves it inline (#431).
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/gif", "image/webp"}')
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;

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
-- Members read every object and upload through internal.is_channel_member. Anon and
-- signed-in non-members read only objects that a live message names (#432).
-- All arms carry the Private gate (#396), and a past member (left_at set) loses member read.
drop policy if exists "Media files are publicly accessible" on storage.objects;
drop policy if exists "User can upload media files" on storage.objects;
drop policy if exists "User can update own media files" on storage.objects;
drop policy if exists "User can delete own media files" on storage.objects;
drop policy if exists "Authed can read public channel chat media" on storage.objects;
drop policy if exists "Channel members can read chat media" on storage.objects;
drop policy if exists "Authed can read chat media" on storage.objects;
drop policy if exists "Anon can read public channel chat media" on storage.objects;
drop policy if exists "User can upload own channel chat media" on storage.objects;
drop policy if exists "User can update own chat media" on storage.objects;
drop policy if exists "User can delete own chat media" on storage.objects;

-- The upload readback and validate_message_medias read an unsent object as the
-- uploader, so the member arm must stay.
-- The path match is raw on purpose. The GC normalizer stops inlining and keeps signed URLs as is.
create policy "Authed can read chat media" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and (
            internal.is_channel_member((storage.foldername(objects.name))[2])
            or (
                internal.can_read_channel((storage.foldername(objects.name))[2])
                and exists (
                    select 1
                      from public.messages m
                     cross join lateral jsonb_array_elements(coalesce(m.medias, '[]'::jsonb)) elem
                     where m.channel_id = (storage.foldername(objects.name))[2]
                       and m.deleted_at is null
                       and coalesce(nullif(elem->>'path', ''), elem->>'url') = objects.name
                )
            )
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
               and internal.can_open_document(c.workspace_id, null::uuid)
        )
        and exists (
            select 1
              from public.messages m
             cross join lateral jsonb_array_elements(coalesce(m.medias, '[]'::jsonb)) elem
             where m.channel_id = (storage.foldername(objects.name))[2]
               and m.deleted_at is null
               and coalesce(nullif(elem->>'path', ''), elem->>'url') = objects.name
        )
    );

create policy "User can upload own channel chat media" on storage.objects
    for insert to authenticated with check (
        bucket_id = 'media'
        and (storage.foldername(objects.name))[1] = (select auth.uid())::text
        and internal.is_channel_member((storage.foldername(objects.name))[2])
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
