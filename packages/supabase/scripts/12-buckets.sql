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
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for User Avatars Bucket
CREATE POLICY "User Avatar is publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'user_avatars');
CREATE POLICY "User can upload an avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'user_avatars');
CREATE POLICY "User can update own avatar" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'user_avatars');
CREATE POLICY "User can delete own avatar" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND  bucket_id = 'user_avatars');

-- Channel Avatars Bucket Configuration
-- Purpose: Store images for chat channels.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for Channel Avatars Bucket
CREATE POLICY "Channel Avatar is publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'channel_avatars');
CREATE POLICY "User can upload a channel avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'channel_avatars');
CREATE POLICY "User can update own channel avatar" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'channel_avatars');
CREATE POLICY "User can delete own channel avatar" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'channel_avatars');

-- Media Files Bucket Configuration
-- Purpose: Store various media files related to messages.
-- Max File Size: 2MB (2,097,152 bytes).
-- Allowed MIME Types: All file types.
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('media', 'media', true, 2097152, '{"*/*"}');

-- Policies for Media Files Bucket
CREATE POLICY "Media files are publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'media');
CREATE POLICY "User can upload media files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "User can update own media files" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'media');
CREATE POLICY "User can delete own media files" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'media');
