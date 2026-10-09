-- Issue #432. Anon and signed-in non-members read only chat media that a live message names.
-- Listing and signing both need SELECT, so an unsent upload was listable with the anon key.
-- Pairs with scripts/12-buckets.sql. Keeps every #396 gate from 20261008130000.

-- Members keep read on every object in the channel. The upload readback and
-- validate_message_medias read an unsent object, and both run as the uploader.
-- The path match is raw on purpose. internal.normalize_chat_media_path stops inlining and keeps signed URLs as is.
drop policy if exists "Authed can read chat media" on storage.objects;
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

-- Inside the EXISTS, objects.name names the storage row.
drop policy if exists "Anon can read public channel chat media" on storage.objects;
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
