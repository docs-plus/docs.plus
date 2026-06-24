-- Chat media attachments — squashed feature migration. Single source for:
--   * private `media` storage bucket + path-based RLS (member/public-anon read, owner write)
--   * message_content_preview + media-aware notification/reply/channel preview wiring
--   * validate_message_medias (path/allowlist/storage-exists, max 10) + soft-delete storage GC
--   * internal storage helpers (normalize path, delete paths, orphan cleanup)
--   * media-aware get_user_bookmarks
--   * media-only feed RPCs: fetch_media_message_window, fetch_media_messages_since
--   * workspace media storage stats: get_workspace_media_storage_stats (+ _all_ variant)
-- Final state mirrors packages/supabase/scripts/. Local re-apply (idempotent):
--   docker exec -i supabase_db_docsplus_supabase psql -U postgres -d postgres \
--     < packages/supabase/migrations/20260623120000_chat_media_attachments.sql

-- =============================================================================
-- Storage bucket + policies
-- =============================================================================

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
             where c.id = (storage.foldername(name))[2]
               and c.type = 'PUBLIC'
        )
    );

create policy "Anon can read public channel chat media" on storage.objects
    for select to anon using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(name))[2]
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

-- =============================================================================
-- Preview helper
-- =============================================================================

create or replace function message_content_preview(
    p_content text,
    p_medias jsonb,
    p_type public.message_type default 'text'
) returns text as $$
declare
    media_count int;
    first_name text;
    first_type text;
begin
    if coalesce(trim(p_content), '') <> '' then
        return truncate_content(p_content);
    end if;

    if p_medias is null or jsonb_typeof(p_medias) <> 'array' then
        return truncate_content('');
    end if;

    media_count := jsonb_array_length(p_medias);
    if media_count = 0 then
        return truncate_content('');
    end if;

    first_name := p_medias->0->>'name';
    first_type := coalesce(p_medias->0->>'type', p_type::text);

    if media_count > 1 then
        return truncate_content(media_count || ' attachments');
    end if;

    if first_type = 'file' and coalesce(first_name, '') <> '' then
        return truncate_content(first_name);
    end if;

    return truncate_content(case first_type
        when 'image' then 'Photo'
        when 'video' then 'Video'
        when 'audio' then 'Audio'
        when 'file' then 'File'
        else 'Attachment'
    end);
end;
$$ language plpgsql;

comment on function message_content_preview(text, jsonb, public.message_type) is
'Generates sidebar/reply/notification preview text from message content or attachment metadata.';

alter function public.message_content_preview(text, jsonb, public.message_type) set search_path = public;

-- =============================================================================
-- Internal storage helpers
-- =============================================================================

create or replace function internal.normalize_chat_media_path(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when p_raw like 'http%' then
            regexp_replace(p_raw, '^.+/storage/v1/object/(sign/)?public/media/', '')
        else p_raw
    end;
$$;

comment on function internal.normalize_chat_media_path(text) is
'Strips signed/public storage URL prefixes to a bucket object path.';

create or replace function internal.delete_chat_media_paths(p_medias jsonb)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    elem jsonb;
    media_path text;
begin
    if p_medias is null or jsonb_typeof(p_medias) <> 'array' then
        return;
    end if;

    -- storage.protect_delete blocks raw DELETEs unless this GUC is set (the same
    -- flag the Storage API uses); scope it to this transaction for the GC below.
    perform set_config('storage.allow_delete_query', 'true', true);

    for elem in select value from jsonb_array_elements(p_medias) as t(value)
    loop
        media_path := internal.normalize_chat_media_path(
            coalesce(nullif(elem->>'path', ''), nullif(elem->>'url', ''))
        );
        if media_path is null or media_path = '' then
            continue;
        end if;

        delete from storage.objects
        where bucket_id = 'media'
          and name = media_path;
    end loop;
end;
$$;

comment on function internal.delete_chat_media_paths(jsonb) is
'Deletes chat media storage objects referenced by a messages.medias array.';

revoke all on function internal.delete_chat_media_paths(jsonb) from public;
grant execute on function internal.delete_chat_media_paths(jsonb) to service_role;

create or replace function internal.cleanup_orphan_chat_media(p_older_than interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    deleted_count integer := 0;
begin
    -- storage.protect_delete blocks raw DELETEs unless this GUC is set (the same
    -- flag the Storage API uses); scope it to this transaction for the GC below.
    perform set_config('storage.allow_delete_query', 'true', true);

    with orphan_objects as (
        select o.name
        from storage.objects o
        where o.bucket_id = 'media'
          and o.created_at < now() - p_older_than
          and not exists (
              select 1
                from public.messages m
                cross join lateral jsonb_array_elements(coalesce(m.medias, '[]'::jsonb)) elem
               where m.deleted_at is null
                 and internal.normalize_chat_media_path(
                       coalesce(nullif(elem->>'path', ''), nullif(elem->>'url', ''))
                     ) = o.name
          )
    )
    delete from storage.objects o
    using orphan_objects orphan
    where o.bucket_id = 'media'
      and o.name = orphan.name;

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

comment on function internal.cleanup_orphan_chat_media(interval) is
'Removes chat media bucket objects older than p_older_than with no live message reference.';

revoke all on function internal.cleanup_orphan_chat_media(interval) from public;
grant execute on function internal.cleanup_orphan_chat_media(interval) to service_role;

-- =============================================================================
-- Message medias validation + soft-delete GC
-- =============================================================================

create or replace function validate_message_medias()
returns trigger as $$
declare
    elem jsonb;
    media_path text;
    expected_prefix text;
    file_ext text;
    blocked_exts text[] := array['exe','bat','cmd','com','msi','dll','scr','vbs','js','sh','app','dmg','jar','apk','svg'];
    allowed_exts text[] := array[
        'jpg','jpeg','png','gif','webp','bmp','heic','heif',
        'mp4','webm','mov','m4v','mkv','ogv',
        'mp3','wav','ogg','m4a','aac','flac','opus',
        'pdf','txt','csv','md','markdown','json',
        'doc','docx','xls','xlsx','ppt','pptx','zip'
    ];
begin
    if new.medias is null then
        return new;
    end if;

    if jsonb_typeof(new.medias) <> 'array' then
        raise exception 'medias must be a JSON array';
    end if;

    if jsonb_array_length(new.medias) > 10 then
        raise exception 'too many media attachments (max 10)';
    end if;

    expected_prefix := new.user_id::text || '/' || new.channel_id || '/';

    for elem in select value from jsonb_array_elements(new.medias) as t(value)
    loop
        media_path := internal.normalize_chat_media_path(
            coalesce(nullif(elem->>'path', ''), nullif(elem->>'url', ''))
        );
        if media_path is null or media_path = '' then
            raise exception 'media item requires path or url';
        end if;

        if media_path not like expected_prefix || '%' then
            raise exception 'invalid media path for message channel';
        end if;

        file_ext := lower(regexp_replace(media_path, '^.*\.([^.]+)$', '\1'));
        if file_ext = media_path then
            file_ext := '';
        end if;

        if file_ext = '' or not (file_ext = any (allowed_exts)) then
            raise exception 'media file type is not allowed';
        end if;

        if file_ext = any (blocked_exts) then
            raise exception 'media file type is not allowed';
        end if;

        if not exists (
            select 1
              from storage.objects o
             where o.bucket_id = 'media'
               and o.name = media_path
        ) then
            raise exception 'media object not found in storage';
        end if;
    end loop;

    return new;
end;
$$ language plpgsql;

comment on function validate_message_medias() is
'Ensures messages.medias paths belong to the sender/channel, pass allowlist, exist in storage, and cap at 10.';

drop trigger if exists validate_message_medias on public.messages;
create trigger validate_message_medias
before insert or update of medias on public.messages
for each row
execute function validate_message_medias();

alter function public.validate_message_medias() set search_path = public, storage;

create or replace function handle_message_soft_delete() returns trigger as $$
declare
    current_metadata jsonb;
begin
    new.deleted_at := now();

    if tg_op = 'UPDATE' then
        delete from public.pinned_messages where message_id = old.id;

        update public.channel_members cm
        set unread_message_count = greatest(0, unread_message_count - 1)
        from (
            select receiver_user_id, channel_id
            from public.notifications
            where message_id = old.id and readed_at is null
        ) n
        where cm.channel_id = n.channel_id and cm.member_id = n.receiver_user_id;

        delete from public.notifications where message_id = old.id;

        update public.messages
        set replied_message_preview = 'The message has been deleted'
        where reply_to_message_id = old.id;

        if old.channel_id is not null and exists (select 1 from public.channels where id = old.channel_id) then
            update public.channels
            set last_message_preview = (
                    select message_content_preview(m.content, m.medias, m.type)
                    from public.messages m
                    where m.channel_id = old.channel_id
                      and m.deleted_at is null
                      and m.id <> old.id
                    order by m.created_at desc, m.id desc
                    limit 1
                ),
                last_activity_at = now()
            where id = old.channel_id;
        end if;

        if new.reply_to_message_id is not null then
            select metadata into current_metadata from public.messages
            where id = new.reply_to_message_id;

            if current_metadata is not null then
                current_metadata := jsonb_set(current_metadata, '{replied}', (current_metadata->'replied') - new.id::text);

                update public.messages
                set metadata = current_metadata
                where id = new.reply_to_message_id;
            end if;
        end if;

        if old.deleted_at is null and new.deleted_at is not null then
            perform internal.delete_chat_media_paths(old.medias);
            perform realtime.send(
                jsonb_build_object('id', new.id, 'channel_id', new.channel_id),
                'message:deleted',
                'chatroom:' || new.channel_id,
                false
            );
        end if;

        return new;
    end if;

    return null;
end;
$$ language plpgsql;

comment on function handle_message_soft_delete() is
'Performs cleanup operations when a message is soft-deleted including updating previews and removing references.';

drop trigger if exists message_soft_delete on public.messages;
create trigger message_soft_delete
after update of deleted_at on public.messages
for each row
execute function handle_message_soft_delete();

create or replace function update_message_preview_on_edit()
returns trigger as $$
declare
    truncated_content text;
begin
    truncated_content := message_content_preview(new.content, new.medias, new.type);

    update public.notifications
    set message_preview = truncated_content
    where message_id = new.id and readed_at is null;

    update public.messages
    set replied_message_preview = truncated_content
    where reply_to_message_id = new.id;

    if new.channel_id is not null and exists (select 1 from public.channels where id = new.channel_id) then
        update public.channels
        set last_message_preview = truncated_content
        where id = new.channel_id;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_message_preview_on_edit() is
'Updates message previews in various tables when a message is edited.';

drop trigger if exists update_message_previews on public.messages;
create trigger update_message_previews
after update of content, medias, type on public.messages
for each row
when (
    old.content is distinct from new.content
    or old.medias is distinct from new.medias
    or old.type is distinct from new.type
)
execute function update_message_preview_on_edit();

create or replace function update_message_edited_at() returns trigger as $$
begin
    if old.content is distinct from new.content
        or old.html is distinct from new.html
        or old.medias is distinct from new.medias then
        new.edited_at := now();
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_message_edited_at() is
'Sets the edited_at timestamp when a message is edited.';

drop trigger if exists set_message_edited_at on public.messages;
create trigger set_message_edited_at
before update of content, html, medias on public.messages
for each row
execute function update_message_edited_at();

alter function public.handle_message_soft_delete() set search_path = public;
alter function public.update_message_preview_on_edit() set search_path = public;
alter function public.update_message_edited_at() set search_path = public;
alter function public.handle_message_soft_delete() security definer;
alter function public.update_message_preview_on_edit() security definer;
alter function public.update_message_edited_at() security definer;

-- =============================================================================
-- Reply + channel preview triggers
-- =============================================================================

create or replace function set_replied_message_preview()
returns trigger as $$
declare
    original_message_content text;
    original_medias jsonb;
    original_type public.message_type;
    truncated_content text;
begin
    if new.reply_to_message_id is not null then
        select content, medias, type
          into original_message_content, original_medias, original_type
          from public.messages
         where id = new.reply_to_message_id and deleted_at is null;

        if found then
            truncated_content := message_content_preview(
                original_message_content,
                original_medias,
                original_type
            );
            new.replied_message_preview := truncated_content;
        else
            new.replied_message_preview := 'The original message is not available.';
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function set_replied_message_preview() is
'Sets the preview content for replied messages by truncating the original message content.';

drop trigger if exists set_reply_message_preview on public.messages;
create trigger set_reply_message_preview
before insert on public.messages
for each row
execute function set_replied_message_preview();

create or replace function update_channel_preview_on_new_message() returns trigger as $$
declare
    truncated_content text;
begin
    truncated_content := message_content_preview(new.content, new.medias, new.type);

    if exists (select 1 from public.channels where id = new.channel_id) then
        update public.channels
        set last_message_preview = truncated_content,
            last_activity_at = timezone('utc', now())
        where id = new.channel_id;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_channel_preview_on_new_message() is
'Updates the last message preview in a channel when a new message is inserted.';

drop trigger if exists update_channel_preview on public.messages;
create trigger update_channel_preview
after insert on public.messages
for each row
execute function update_channel_preview_on_new_message();

alter function public.set_replied_message_preview() set search_path = public;
alter function public.update_channel_preview_on_new_message() set search_path = public;
alter function public.set_replied_message_preview() security definer;
alter function public.update_channel_preview_on_new_message() security definer;

-- =============================================================================
-- Notification previews (media-aware)
-- =============================================================================

create or replace function create_mention_notifications()
returns trigger as $$
declare
    mentioned_user_id uuid;
    is_channel_muted boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found then
        return new;
    end if;

    if is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1
          from public.users
         where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := message_content_preview(new.content, new.medias, new.type);

    for mentioned_user_id in
        select u.id
          from public.users u
         where new.content ~ ('(^|[^a-z0-9_-])@' || u.username || '($|[^a-z0-9_-])')
    loop
        if exists (
            select 1
              from public.channel_members
             where channel_id = new.channel_id
               and member_id  = mentioned_user_id
               and mute_in_app_notifications = false
               and notif_state != 'MUTED'
        ) then
            insert into public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            values (
                mentioned_user_id,
                new.user_id,
                'mention',
                new.id,
                new.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        end if;
    end loop;

    return new;
end;
$$ language plpgsql;

create or replace function create_reply_notification()
returns trigger as $$
declare
    original_message record;
    truncated_content text;
begin
    if new.reply_to_message_id is null then
        return new;
    end if;

    select m.user_id, m.channel_id, c.mute_in_app_notifications
    into original_message
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.id = new.reply_to_message_id;

    if not found then
        return new;
    end if;

    if original_message.mute_in_app_notifications then
        return new;
    end if;

    if original_message.user_id = new.user_id then
        return new;
    end if;

    if exists (
        select 1 from public.channel_members
        where channel_id = new.channel_id
          and member_id = original_message.user_id
          and mute_in_app_notifications = true
    ) then
        return new;
    end if;

    truncated_content := message_content_preview(new.content, new.medias, new.type);

    insert into public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    ) values (
        original_message.user_id,
        new.user_id,
        'reply'::notification_category,
        new.id,
        new.channel_id,
        truncated_content,
        timezone('utc', now())
    );

    return new;
end;
$$ language plpgsql;

create or replace function create_everyone_notifications()
returns trigger as $$
declare
    channel_member_id uuid;
    is_channel_muted  boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found or is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1
          from public.users
         where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := message_content_preview(new.content, new.medias, new.type);

    if new.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])' then
        for channel_member_id in
            select cm.member_id
              from public.channel_members cm
             where cm.channel_id = new.channel_id
               and cm.member_id != new.user_id
               and cm.mute_in_app_notifications = false
               and cm.notif_state != 'MUTED'
        loop
            insert into public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            values (
                channel_member_id,
                new.user_id,
                'channel_event',
                new.id,
                new.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        end loop;
    end if;

    return new;
end;
$$ language plpgsql;

create or replace function create_regular_message_notifications()
returns trigger as $$
declare
    is_channel_muted  boolean;
    truncated_content text;
begin
    select mute_in_app_notifications
      into is_channel_muted
      from public.channels
     where id = new.channel_id;

    if not found or is_channel_muted then
        return new;
    end if;

    if not exists (
        select 1
          from public.users
         where id = new.user_id
    ) then
        return new;
    end if;

    truncated_content := message_content_preview(new.content, new.medias, new.type);

    insert into public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    )
    select
        cm.member_id,
        new.user_id,
        'message'::notification_category,
        new.id,
        new.channel_id,
        truncated_content,
        timezone('utc', now())
    from public.channel_members cm
    join public.users u on u.id = cm.member_id
    where cm.channel_id = new.channel_id
      and cm.member_id  != new.user_id
      and (u.status is null or u.status != 'ONLINE')
      and cm.mute_in_app_notifications = false
      and cm.notif_state = 'ALL';

    return new;
end;
$$ language plpgsql;

drop trigger if exists create_mention_notifications on public.messages;
create trigger create_mention_notifications
after insert on public.messages
for each row
when (new.content like '%@%')
execute function create_mention_notifications();

drop trigger if exists create_reply_notification on public.messages;
create trigger create_reply_notification
after insert on public.messages
for each row
when (new.reply_to_message_id is not null)
execute function create_reply_notification();

drop trigger if exists create_everyone_notifications on public.messages;
create trigger create_everyone_notifications
after insert on public.messages
for each row
when (new.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])')
execute function create_everyone_notifications();

drop trigger if exists create_regular_message_notifications on public.messages;
create trigger create_regular_message_notifications
after insert on public.messages
for each row
when (new.content !~ '@[A-Za-z0-9_]+|@everyone')
execute function create_regular_message_notifications();

-- =============================================================================
-- Bookmarks: media-aware preview column
-- =============================================================================

create or replace function public.get_user_bookmarks(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false,
    p_limit int default 50,
    p_offset int default 0
)
returns table (
    bookmark_id bigint,
    bookmark_created_at timestamptz,
    bookmark_updated_at timestamptz,
    bookmark_archived_at timestamptz,
    bookmark_marked_at timestamptz,
    bookmark_metadata jsonb,
    message_id uuid,
    message_content text,
    message_html text,
    message_created_at timestamptz,
    message_user_id uuid,
    message_channel_id varchar,
    message_type message_type,
    user_details jsonb,
    channel_name text,
    channel_slug text,
    workspace_id varchar,
    workspace_name text,
    workspace_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    return query
    select
        mb.id as bookmark_id,
        mb.created_at as bookmark_created_at,
        mb.updated_at as bookmark_updated_at,
        mb.archived_at as bookmark_archived_at,
        mb.marked_at as bookmark_marked_at,
        mb.metadata as bookmark_metadata,
        m.id as message_id,
        message_content_preview(m.content, m.medias, m.type) as message_content,
        m.html as message_html,
        m.created_at as message_created_at,
        m.user_id as message_user_id,
        m.channel_id as message_channel_id,
        m.type as message_type,
        user_details_json(u) as user_details,
        c.name as channel_name,
        c.slug as channel_slug,
        w.id as workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join users u on m.user_id = u.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        )
    order by mb.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;

comment on function public.get_user_bookmarks is
'Retrieves bookmarked messages for the current user with full message and channel context. Can filter by workspace and archived status.';

-- =============================================================================
-- Media-only feed: window RPC + workspace storage stats
-- =============================================================================

create or replace function public.fetch_media_message_window(
  p_channel_id varchar,
  p_before_seq bigint default null,
  p_limit int default 40
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_min_seq bigint;
  v_has_more_before boolean;
begin
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
    into v_rows
    from (
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = (select auth.uid())
      where m.channel_id = p_channel_id
        and m.deleted_at is null
        and m.medias is not null
        and jsonb_typeof(m.medias) = 'array'
        and jsonb_array_length(m.medias) > 0
        and (p_before_seq is null or m.seq < p_before_seq)
      order by m.seq desc
      limit greatest(p_limit, 1)
    ) t;

  if v_rows = '[]'::jsonb then
    return jsonb_build_object(
      'rows', '[]'::jsonb,
      'anchor_seq', null,
      'has_more_before', false,
      'has_more_after', false
    );
  end if;

  select min((elem->>'seq')::bigint)
    into v_min_seq
    from jsonb_array_elements(v_rows) elem;

  v_has_more_before := exists (
    select 1
    from public.messages m
    where m.channel_id = p_channel_id
      and m.deleted_at is null
      and m.medias is not null
      and jsonb_typeof(m.medias) = 'array'
      and jsonb_array_length(m.medias) > 0
      and m.seq < v_min_seq
  );

  return jsonb_build_object(
    'rows', v_rows,
    'anchor_seq', null,
    'has_more_before', v_has_more_before,
    'has_more_after', false
  );
end;
$$;

comment on function public.fetch_media_message_window(varchar, bigint, int) is
  'Returns a descending-fetched, ascending-ordered page of messages that have attachments.';

grant execute on function public.fetch_media_message_window(varchar, bigint, int) to authenticated, anon;

-- Chat media object paths: {userId}/{channelId}/{uuid}.ext — workspace via segment 2 = channel_id.

create or replace function internal.media_workspace_quota_bytes()
returns bigint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 10737418240::bigint;
$$;

comment on function internal.media_workspace_quota_bytes() is
  'Per-workspace chat media quota (10 GiB). Stats RPCs and enforce_media_workspace_quota read this.';

revoke all on function internal.media_workspace_quota_bytes() from public;

create or replace function internal.media_workspace_usage_rows()
returns table(
  workspace_id varchar(36),
  total_bytes bigint,
  object_count bigint
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    c.workspace_id,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as total_bytes,
    count(*)::bigint as object_count
  from storage.objects o
  inner join public.channels c on c.id = split_part(o.name, '/', 2)
  where o.bucket_id = 'media'
  group by c.workspace_id;
$$;

comment on function internal.media_workspace_usage_rows() is
  'Aggregates media bucket usage by workspace (channel_id = split_part(path, ''/'', 2)).';

revoke all on function internal.media_workspace_usage_rows() from public;

drop function if exists public.get_workspace_media_storage_stats(uuid);
drop function if exists public.get_all_workspace_media_storage_stats();
drop function if exists public.get_workspace_media_storage_summary();

create or replace function public.get_workspace_media_storage_stats(p_workspace_id varchar(36))
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  with quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select jsonb_build_object(
    'workspace_id', w.id,
    'slug', w.slug,
    'name', w.name,
    'total_bytes', coalesce(u.total_bytes, 0),
    'object_count', coalesce(u.object_count, 0),
    'quota_bytes', quota.q,
    'usage_percent', case
      when quota.q > 0
      then round((coalesce(u.total_bytes, 0)::numeric / quota.q) * 100)::int
      else 0
    end
  )
  from public.workspaces w
  cross join quota
  left join internal.media_workspace_usage_rows() u on u.workspace_id = w.id
  where w.id = p_workspace_id;
$$;

comment on function public.get_workspace_media_storage_stats(varchar) is
  'Per-workspace chat media usage row (same shape as fleet RPC rows).';

revoke all on function public.get_workspace_media_storage_stats(varchar) from public;
grant execute on function public.get_workspace_media_storage_stats(varchar) to service_role;

create or replace function public.get_all_workspace_media_storage_stats()
returns table(
  workspace_id varchar(36),
  slug text,
  name text,
  total_bytes bigint,
  object_count bigint,
  quota_bytes bigint,
  usage_percent int
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select
    u.workspace_id,
    w.slug,
    w.name,
    u.total_bytes,
    u.object_count,
    quota.q as quota_bytes,
    case
      when quota.q > 0
      then round((u.total_bytes::numeric / quota.q) * 100)::int
      else 0
    end as usage_percent
  from internal.media_workspace_usage_rows() u
  left join public.workspaces w on w.id = u.workspace_id
  cross join quota
  order by u.total_bytes desc;
$$;

comment on function public.get_all_workspace_media_storage_stats() is
  'Fleet list of workspaces with chat media (admin service reads once, paginates in TS).';

revoke all on function public.get_all_workspace_media_storage_stats() from public;
grant execute on function public.get_all_workspace_media_storage_stats() to service_role;

create or replace function public.get_workspace_media_storage_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  with usage as (
    select * from internal.media_workspace_usage_rows()
  ),
  quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select jsonb_build_object(
    'total_bytes', coalesce((select sum(total_bytes) from usage), 0),
    'total_objects', coalesce((select sum(object_count) from usage), 0),
    'workspace_count', coalesce((select count(*)::int from usage), 0),
    'over_quota_count', coalesce((
      select count(*)::int
      from usage u
      cross join quota q
      where q.q > 0
        and round((u.total_bytes::numeric / q.q) * 100)::int >= 100
    ), 0),
    'quota_bytes', (select q from quota)
  );
$$;

comment on function public.get_workspace_media_storage_summary() is
  'Fleet rollup for admin media storage StatCards.';

revoke all on function public.get_workspace_media_storage_summary() from public;
grant execute on function public.get_workspace_media_storage_summary() to service_role;

-- =============================================================================
-- Media-only catchup RPC (mirrors fetch_messages_since with attachment filter)
-- =============================================================================

create or replace function public.fetch_media_messages_since(
  p_channel_id varchar(36),
  p_since_seq bigint,
  p_limit int default 100
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  from (
    select m.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'fullname', u.full_name,
        'avatar_url', u.avatar_url,
        'avatar_updated_at', u.avatar_updated_at
      ) as user_details,
      (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
      mb.id as bookmark_id
    from public.messages m
    left join public.users u on u.id = m.user_id
    left join public.message_bookmarks mb
      on mb.message_id = m.id and mb.user_id = (select auth.uid())
    where m.channel_id = p_channel_id
      and m.seq > p_since_seq
      and m.deleted_at is null
      and m.medias is not null
      and jsonb_typeof(m.medias) = 'array'
      and jsonb_array_length(m.medias) > 0
    order by m.seq asc
    limit p_limit
  ) t;
$$;

comment on function public.fetch_media_messages_since(varchar, bigint, int) is
  'Catchup refetch for media-only feed: messages with attachments and seq > p_since_seq.';

grant execute on function public.fetch_media_messages_since(varchar, bigint, int) to authenticated, anon;

alter function public.fetch_media_messages_since(varchar, bigint, int) set search_path = public;
alter function public.fetch_media_message_window(varchar, bigint, int) set search_path = public;

-- =============================================================================
-- Workspace media quota enforcement (10 GB) + scheduled orphan GC
-- =============================================================================

create or replace function internal.enforce_media_workspace_quota()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    v_workspace_id text;
    v_used bigint;
    v_incoming bigint;
    v_quota bigint;
begin
    select c.workspace_id into v_workspace_id
    from public.channels c
    where c.id = split_part(new.name, '/', 2);

    if v_workspace_id is null then
        return new;
    end if;

    v_incoming := coalesce((new.metadata->>'size')::bigint, 0);
    v_quota := internal.media_workspace_quota_bytes();

    select coalesce(sum((o.metadata->>'size')::bigint), 0) into v_used
    from storage.objects o
    inner join public.channels c on c.id = split_part(o.name, '/', 2)
    where o.bucket_id = 'media'
      and c.workspace_id = v_workspace_id;

    if v_used + v_incoming > v_quota then
        raise exception 'Workspace media storage quota exceeded (10 GiB limit)'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

comment on function internal.enforce_media_workspace_quota() is
'Rejects media uploads that would push a workspace past the 10 GiB storage quota.';

revoke all on function internal.enforce_media_workspace_quota() from public;

drop trigger if exists enforce_media_workspace_quota on storage.objects;
create trigger enforce_media_workspace_quota
before insert on storage.objects
for each row
when (new.bucket_id = 'media')
execute function internal.enforce_media_workspace_quota();

-- Daily orphan-media GC: drop bucket objects with no live messages.medias
-- reference, older than 24h. Guarded so the migration is safe where pg_cron
-- is unavailable; scripts/16-cron-jobs.sql is the canonical schedule for db reset.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule('cleanup-orphan-chat-media')
        from cron.job where jobname = 'cleanup-orphan-chat-media';

        perform cron.schedule(
            'cleanup-orphan-chat-media',
            '30 3 * * *',
            $job$ select internal.cleanup_orphan_chat_media(interval '24 hours'); $job$
        );
    end if;
end $$;
