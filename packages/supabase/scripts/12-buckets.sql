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
*/

-- User Avatars Bucket Configuration
-- Purpose: Store user profile images.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for User Avatars Bucket
create policy "User Avatar is publicly accessible" on storage.objects
    for select to authenticated using (bucket_id = 'user_avatars');
create policy "User can upload an avatar" on storage.objects
    for insert with check (bucket_id = 'user_avatars');
create policy "User can update own avatar" on storage.objects
    for update to authenticated using (auth.uid() = owner and bucket_id = 'user_avatars');
create policy "User can delete own avatar" on storage.objects
    for delete to authenticated using (auth.uid() = owner and  bucket_id = 'user_avatars');

-- Channel Avatars Bucket Configuration
-- Purpose: Store images for chat channels.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for Channel Avatars Bucket
create policy "Channel Avatar is publicly accessible" on storage.objects
    for select to authenticated using (bucket_id = 'channel_avatars');
create policy "User can upload a channel avatar" on storage.objects
    for insert with check (bucket_id = 'channel_avatars');
create policy "User can update own channel avatar" on storage.objects
    for update to authenticated using (auth.uid() = owner and bucket_id = 'channel_avatars');
create policy "User can delete own channel avatar" on storage.objects
    for delete to authenticated using (auth.uid() = owner and bucket_id = 'channel_avatars');

-- Media Files Bucket Configuration
-- Purpose: Store various media files related to messages.
-- Max File Size: 2MB (2,097,152 bytes).
-- Allowed MIME Types: All file types.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('media', 'media', true, 2097152, '{"*/*"}');

-- Policies for Media Files Bucket
create policy "Media files are publicly accessible" on storage.objects
    for select to authenticated using (bucket_id = 'media');
create policy "User can upload media files" on storage.objects
    for insert to authenticated with check (bucket_id = 'media');
create policy "User can update own media files" on storage.objects
    for update to authenticated using (auth.uid() = owner and bucket_id = 'media');
create policy "User can delete own media files" on storage.objects
    for delete to authenticated using (auth.uid() = owner and bucket_id = 'media');
