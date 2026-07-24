/*
 * Message Management Functions
 * This file contains functions and triggers related to message operations:
 * - Message soft deletion
 * - Message editing and content updates
 * - Message preview generation
 */

/**
 * Function: handle_message_soft_delete
 * Description: Performs cleanup operations when a message is soft-deleted
 * Trigger: Executes after UPDATE of deleted_at on public.messages
 * Action:
 *   - Deletes related pinned messages
 *   - Decrements unread_message_count for users with unread notifications
 *   - Deletes related notifications
 *   - Updates related reply references
 *   - Updates channel last_message_preview if needed
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION handle_message_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Set deleted_at timestamp for soft delete
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        -- Delete pinned message
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        -- Decrement unread count for users with unread notifications for this message
        -- Must happen BEFORE deleting notifications so we know who to decrement
        UPDATE public.channel_members cm
        SET unread_message_count = GREATEST(0, unread_message_count - 1)
        FROM (
            SELECT receiver_user_id, channel_id
            FROM public.notifications
            WHERE message_id = OLD.id AND readed_at IS NULL
        ) n
        WHERE cm.channel_id = n.channel_id AND cm.member_id = n.receiver_user_id;

        -- Delete associated notifications
        DELETE FROM public.notifications WHERE message_id = OLD.id;

        -- Update reply previews
        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        -- Refresh the channel preview to the next-newest non-deleted message.
        -- If OLD wasn't the latest, this resolves to the same row already in
        -- last_message_preview (no-op effect). If OLD was the latest, this
        -- pulls in the previous message. NULL when the channel is now empty.
        IF OLD.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = OLD.channel_id) THEN
            UPDATE public.channels
            SET last_message_preview = (
                    SELECT message_content_preview(m.content, m.medias, m.type)
                    FROM public.messages m
                    WHERE m.channel_id = OLD.channel_id
                      AND m.deleted_at IS NULL
                      AND m.id <> OLD.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1
                ),
                last_activity_at = NOW()
            WHERE id = OLD.channel_id;
        END IF;

        -- Remove the reply from the metadata of the original message
        IF NEW.reply_to_message_id IS NOT NULL THEN
            SELECT metadata INTO current_metadata FROM public.messages
            WHERE id = NEW.reply_to_message_id;

            IF current_metadata IS NOT NULL THEN
                -- Remove the deleted message ID from the 'replied' array
                current_metadata := jsonb_set(current_metadata, '{replied}', (current_metadata->'replied') - NEW.id::text);

                -- Update the original message's metadata
                UPDATE public.messages
                SET metadata = current_metadata
                WHERE id = NEW.reply_to_message_id;
            END IF;
        END IF;

        -- Anon viewers can't observe soft-deletes via postgres_changes — the
        -- anon SELECT policy (messages_public_anon_select) filters
        -- `deleted_at IS NULL`, so the realtime layer drops the UPDATE event
        -- whose NEW row fails the policy. Emit a broadcast on the NULL → NOT
        -- NULL transition so subscribers prune locally. Payload is id +
        -- channel only; no content leak.
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            PERFORM internal.delete_chat_media_paths(OLD.medias);
            PERFORM realtime.send(
                jsonb_build_object('id', NEW.id, 'channel_id', NEW.channel_id),
                'message:deleted',
                'chatroom:' || NEW.channel_id,
                FALSE
            );
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL; -- Should not reach here for an UPDATE trigger
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_message_soft_delete() IS 'Performs cleanup operations when a message is soft-deleted including updating previews and removing references.';

-- Guard on the NULL -> NOT NULL transition (matches the sibling counter
-- trigger in 09-message_counter.sql). Without it the cleanup body — notification
-- purge, unread decrement, preview rewrites, media GC, delete broadcast — runs on
-- ANY deleted_at write, so a PATCH {deleted_at:null} on the caller's own live
-- message fires the whole DEFINER body while the message stays visible.
CREATE TRIGGER message_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION handle_message_soft_delete();

COMMENT ON TRIGGER message_soft_delete ON public.messages IS 'Handles additional actions when a message is soft-deleted.';

/**
 * Function: update_message_preview_on_edit
 * Description: Updates message previews across the system when a message is edited
 * Trigger: Executes after UPDATE of content on public.messages
 * Action: Updates previews in notifications, replies, and channel
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION update_message_preview_on_edit()
RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
BEGIN
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

    -- Update unread notification preview
    UPDATE public.notifications
    SET message_preview = truncated_content
    WHERE message_id = NEW.id AND readed_at IS NULL;

    -- Update previews for messages that are replies to the edited message
    UPDATE public.messages
    SET replied_message_preview = truncated_content
    WHERE reply_to_message_id = NEW.id;

    -- Update last message preview in the channel of the edited message
    IF NEW.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_preview_on_edit() IS 'Updates message previews in various tables when a message is edited.';

CREATE TRIGGER update_message_previews
AFTER UPDATE OF content, medias, type ON public.messages
FOR EACH ROW
WHEN (
    OLD.content IS DISTINCT FROM NEW.content
    OR OLD.medias IS DISTINCT FROM NEW.medias
    OR OLD.type IS DISTINCT FROM NEW.type
)
EXECUTE FUNCTION update_message_preview_on_edit();

COMMENT ON TRIGGER update_message_previews ON public.messages IS 'Updates message previews throughout the system when message content changes.';

/**
 * Function: update_message_edited_at
 * Description: Sets the edited_at timestamp when message content or HTML is modified
 * Trigger: Executes before UPDATE of content or html on public.messages
 * Action: Sets the edited_at timestamp to the current time
 * Returns: The modified NEW record
 */
CREATE OR REPLACE FUNCTION update_message_edited_at() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content
        OR OLD.html IS DISTINCT FROM NEW.html
        OR OLD.medias IS DISTINCT FROM NEW.medias THEN
        NEW.edited_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_edited_at() IS 'Sets the edited_at timestamp when a message is edited.';

CREATE TRIGGER set_message_edited_at
BEFORE UPDATE OF content, html, medias ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_message_edited_at();

COMMENT ON TRIGGER set_message_edited_at ON public.messages IS 'Sets the edited_at timestamp when message content or HTML is updated.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.handle_message_soft_delete() SET search_path = public;
ALTER FUNCTION public.update_message_preview_on_edit() SET search_path = public;
ALTER FUNCTION public.update_message_edited_at() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.handle_message_soft_delete() SECURITY DEFINER;
ALTER FUNCTION public.update_message_preview_on_edit() SECURITY DEFINER;
ALTER FUNCTION public.update_message_edited_at() SECURITY DEFINER;

-- ============================================================
-- v2 reactions RPCs. Direct messages.update from the FE is removed;
-- reactions go through these. SELECT ... FOR UPDATE prevents lost
-- updates on concurrent toggles. The persisted shape is the v1 object
-- { [emoji]: [{user_id, created_at}, …] } so ReactionList /
-- AddReactionButton readers stay untouched.
-- ============================================================

create or replace function public.add_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
  v_already_reacted boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if length(p_emoji) = 0 or length(p_emoji) > 16 then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_already_reacted := exists (
    select 1 from jsonb_array_elements(v_users) elt
    where elt->>'user_id' = v_uid::text
  );

  if not v_already_reacted then
    v_users := v_users || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_uid::text,
        'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    );
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
    update public.messages set reactions = v_reactions where id = p_message_id;
  end if;

  return v_reactions;
end;
$$;

grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;

create or replace function public.remove_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_users := coalesce((
    select jsonb_agg(elt)
    from jsonb_array_elements(v_users) elt
    where elt->>'user_id' <> v_uid::text
  ), '[]'::jsonb);

  if jsonb_array_length(v_users) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
  end if;

  update public.messages set reactions = v_reactions where id = p_message_id;

  return v_reactions;
end;
$$;

grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;

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
