-- Issue #431. The public avatar buckets stop accepting SVG. A public bucket serves SVG inline,
-- and an SVG can carry script. Pairs with scripts/12-buckets.sql. A missing row makes this a no-op.

update storage.buckets
   set allowed_mime_types = '{"image/jpeg","image/png","image/gif","image/webp"}'
 where id in ('user_avatars', 'channel_avatars');
