-- Fix public-channel chat media SELECT policies on storage.objects.
--
-- Inside `FROM public.channels c`, unqualified `name` bound to c.name (slug),
-- not the storage object path — anon/authed lurkers could never sign media URLs.
-- Qualify as objects.name (mirrors scripts/12-buckets.sql).

drop policy if exists "Authed can read public channel chat media" on storage.objects;
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

drop policy if exists "Anon can read public channel chat media" on storage.objects;
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
