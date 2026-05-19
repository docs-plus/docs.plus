-- Sender-side "seen" check-mark: peer read-cursor high-watermark.
--   1. get_channel_aggregate_data returns new column `peer_max_read_seq`
--      so the FE seeds the check-mark on initial chatroom mount.
--   2. advance_read_cursor fans out a `read:advanced` realtime
--      broadcast on a private `chatroom-read:{channel_id}` topic gated
--      by `chatroom_read_topic_access` on `realtime.messages` (members
--      only). Sender-side check-marks flip without subscribing to
--      channel_members postgres_changes.
-- Paired with packages/supabase/scripts/10-functions.sql.

DROP FUNCTION IF EXISTS get_channel_aggregate_data(VARCHAR(36), INT, UUID);

CREATE OR REPLACE FUNCTION get_channel_aggregate_data(
    input_channel_id VARCHAR(36),
    message_limit INT DEFAULT 20,
    anchor_message_id UUID DEFAULT NULL
)
RETURNS TABLE(
    channel_info JSONB,
    last_messages JSONB,
    pinned_messages JSONB,
    is_user_channel_member BOOLEAN,
    channel_member_info JSONB,
    total_messages_since_last_read INT,
    unread_message BOOLEAN,
    last_read_message_id UUID,
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE,
    last_read_seq BIGINT,
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE,
    older_cursor TIMESTAMP WITH TIME ZONE,
    newer_cursor TIMESTAMP WITH TIME ZONE,
    has_more_older BOOLEAN,
    has_more_newer BOOLEAN,
    peer_max_read_seq BIGINT
) AS $$
DECLARE
    channel_result JSONB;
    messages_result JSONB;
    pinned_result JSONB;
    is_member_result BOOLEAN;
    channel_member_info_result JSONB;
    total_messages_since_last_read INT;
    last_read_message_id UUID;
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE;
    last_read_seq_result BIGINT;
    unread_message BOOLEAN := FALSE;
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE;
    resolved_anchor_id UUID;
    before_n INT;
    after_n INT;
    older_cursor_result TIMESTAMP WITH TIME ZONE;
    newer_cursor_result TIMESTAMP WITH TIME ZONE;
    has_more_older_result BOOLEAN := FALSE;
    has_more_newer_result BOOLEAN := FALSE;
    peer_max_read_seq_result BIGINT;
BEGIN
    -- Check if the channel exists and is not deleted
    SELECT json_build_object(
               'id', c.id,
               'slug', c.slug,
               'name', c.name,
               'created_by', c.created_by,
               'description', c.description,
               'member_limit', c.member_limit,
               'is_avatar_set', c.is_avatar_set,
               'allow_emoji_reactions', c.allow_emoji_reactions,
               'mute_in_app_notifications', c.mute_in_app_notifications,
               'type', c.type,
               'member_count', c.member_count,
               'metadata', c.metadata
           ) INTO channel_result
    FROM public.channels c
    WHERE c.id = input_channel_id AND c.deleted_at IS NULL;

    -- Empty-room signal: a chatroom is heading-keyed and is created
    -- lazily by the first authenticated chatter. Anonymous visitors and
    -- authenticated visitors who land before any author has chatted in
    -- this heading hit the missing-channel case. Treat it as a normal
    -- empty state, not an error: return one row with channel_info NULL
    -- so the FE wrapper's `.single()` succeeds and the caller can render
    -- the "no messages yet" view instead of the failure badge.
    IF channel_result IS NULL THEN
        RETURN QUERY SELECT
            NULL::JSONB                       AS channel_info,
            '[]'::JSONB                       AS last_messages,
            '[]'::JSONB                       AS pinned_messages,
            FALSE                             AS is_user_channel_member,
            NULL::JSONB                       AS channel_member_info,
            0                                 AS total_messages_since_last_read,
            FALSE                             AS unread_message,
            NULL::UUID                        AS last_read_message_id,
            NULL::TIMESTAMP WITH TIME ZONE    AS last_read_message_timestamp,
            NULL::BIGINT                      AS last_read_seq,
            NULL::TIMESTAMP WITH TIME ZONE    AS anchor_message_timestamp,
            NULL::TIMESTAMP WITH TIME ZONE    AS older_cursor,
            NULL::TIMESTAMP WITH TIME ZONE    AS newer_cursor,
            FALSE                             AS has_more_older,
            FALSE                             AS has_more_newer,
            NULL::BIGINT                      AS peer_max_read_seq;
        RETURN;
    END IF;

    -- Authorization: PUBLIC channels are readable by anyone; everything
    -- else requires explicit channel membership. Without this gate, the
    -- function streams full message history + sender PII to anyone who
    -- learns a channel id (the schema currently has no live RLS on
    -- `messages` / `channel_members`).
    IF (channel_result->>'type') <> 'PUBLIC'
       AND NOT EXISTS (
           SELECT 1
           FROM public.channel_members cm
           WHERE cm.channel_id = input_channel_id
             AND cm.member_id  = auth.uid()
             AND cm.left_at IS NULL
       )
    THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of channel %.', input_channel_id;
    END IF;

    -- Attempt to get channel member details. v2: include last_read_seq as the
    -- new cursor source; last_read_message_id is kept for deploy-4 cleanup.
    SELECT json_build_object(
            'last_read_message_id', cm.last_read_message_id,
            'last_read_seq', cm.last_read_seq,
            'last_read_update_at', cm.last_read_update_at,
            'joined_at', cm.joined_at,
            'left_at', cm.left_at,
            'mute_in_app_notifications', cm.mute_in_app_notifications,
            'channel_member_role', cm.channel_member_role,
            'unread_message_count', cm.unread_message_count
        )
    INTO channel_member_info_result
    FROM public.channel_members cm
    WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

    -- Set is_member_result based on whether channel_member_info_result is null
    is_member_result := (channel_member_info_result IS NOT NULL);

    -- Bootstrap seed for the sender-side check-mark; later advances
    -- arrive via the `read:advanced` broadcast in advance_read_cursor.
    -- Members only: leaks peer activity (online-status recon) otherwise.
    IF is_member_result THEN
      SELECT MAX(cm.last_read_seq) INTO peer_max_read_seq_result
      FROM public.channel_members cm
      WHERE cm.channel_id = input_channel_id
        AND cm.member_id <> auth.uid()
        AND cm.left_at IS NULL;
    END IF;

    -- Get the last_read_message_id, last_read_seq, and timestamp for the current
    -- user in the channel. last_read_seq is the v2 cursor used by useReadCursor.
    IF is_member_result THEN
        SELECT cm.last_read_message_id, cm.last_read_seq
          INTO last_read_message_id, last_read_seq_result
        FROM public.channel_members cm
        WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

        -- Get the timestamp of the last read message
        IF last_read_message_id IS NOT NULL THEN
            SELECT created_at INTO last_read_message_timestamp
            FROM public.messages
            WHERE id = last_read_message_id AND deleted_at IS NULL;
        END IF;
    END IF;

    -- Count messages strictly after the last-read cursor (TOC badge / unread line).
    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages
    WHERE channel_id = input_channel_id
        AND deleted_at IS NULL
        AND created_at > COALESCE(last_read_message_timestamp, 'epoch'::timestamp);

    unread_message := (total_messages_since_last_read > 0);

    -- Initial window anchor: explicit msg_id deep-link, else member last-read row (bounded window — never inflate LIMIT to full unread count).
    resolved_anchor_id := NULL;
    anchor_message_timestamp := NULL;

    IF anchor_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = anchor_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NULL THEN
            RAISE EXCEPTION 'Anchor message % does not exist or has been deleted.', anchor_message_id;
        END IF;
        resolved_anchor_id := anchor_message_id;
    ELSIF last_read_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = last_read_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NOT NULL THEN
            resolved_anchor_id := last_read_message_id;
        END IF;
    END IF;

    IF resolved_anchor_id IS NULL THEN
        -- Newest tail: anon, non-member PUBLIC read, no last-read row, or deleted last-read message.
        SELECT COALESCE(json_agg(t), '[]'::json) INTO messages_result
        FROM (
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT message_limit
        ) t;
    ELSE
        -- Implicit last-read (large unread): bias toward newer rows so newer_cursor/has_more_newer match pagination.
        IF anchor_message_id IS NULL AND total_messages_since_last_read > message_limit / 2 THEN
            before_n := GREATEST(message_limit / 5, 1);
            after_n := message_limit - before_n;
        ELSE
            before_n := GREATEST(message_limit / 2, 1);
            after_n := message_limit - before_n;
        END IF;

        WITH messages_before AS (
            -- Get messages before or at the anchor
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                -- Bookmark information
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
                AND m.created_at <= anchor_message_timestamp
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT before_n
        ),
        messages_after AS (
            -- Get messages after the anchor
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                -- Bookmark information
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
                AND m.created_at > anchor_message_timestamp
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT after_n
        ),
        combined_messages AS (
            -- Combine the before and after messages
            SELECT * FROM messages_before
            UNION ALL
            SELECT * FROM (SELECT * FROM messages_after ORDER BY created_at DESC) as sorted_after
        )
        SELECT COALESCE(json_agg(cm), '[]'::json) INTO messages_result
        FROM (
            SELECT * FROM combined_messages
            ORDER BY created_at DESC, id DESC
            LIMIT message_limit
        ) cm;
    END IF;

    -- Derive pagination cursors from the materialized messages_result
    SELECT
        MIN((m->>'created_at')::TIMESTAMPTZ),
        MAX((m->>'created_at')::TIMESTAMPTZ)
    INTO older_cursor_result, newer_cursor_result
    FROM jsonb_array_elements(messages_result) AS m;

    IF older_cursor_result IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.messages
            WHERE channel_id = input_channel_id
              AND deleted_at IS NULL
              AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND created_at < older_cursor_result
        ) INTO has_more_older_result;
    END IF;

    IF newer_cursor_result IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.messages
            WHERE channel_id = input_channel_id
              AND deleted_at IS NULL
              AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND created_at > newer_cursor_result
        ) INTO has_more_newer_result;
    END IF;

    -- Query for the pinned messages
    SELECT COALESCE(json_agg(pm), '[]'::json) INTO pinned_result
    FROM public.pinned_messages pm
    JOIN public.messages m ON pm.message_id = m.id
    WHERE pm.channel_id = input_channel_id
      AND m.deleted_at IS NULL;

    -- Return the results including the user data
    RETURN QUERY SELECT
        channel_result,
        messages_result,
        pinned_result,
        is_member_result,
        channel_member_info_result,
        COALESCE(total_messages_since_last_read, 0),
        unread_message,
        last_read_message_id,
        last_read_message_timestamp,
        last_read_seq_result,
        anchor_message_timestamp,
        older_cursor_result,
        newer_cursor_result,
        has_more_older_result,
        has_more_newer_result,
        peer_max_read_seq_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- advance_read_cursor: single-row UPDATE on channel_members.last_read_seq,
-- recomputes unread_message_count, stamps last_read_update_at. One row
-- broadcasts via realtime — useful for cross-tab sync without flooding.
create or replace function public.advance_read_cursor(
  p_channel_id varchar(36),
  p_up_to_seq  bigint
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_seq bigint;
  v_unread int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- FOR UPDATE locks the row so concurrent advances (open tab + mobile)
  -- cannot interleave SELECT/UPDATE and flap unread_message_count.
  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid
  for update;

  if v_new_seq is null then
    return;
  end if;

  select coalesce(count(*), 0) into v_unread
  from public.messages
  where channel_id = p_channel_id
    and deleted_at is null
    and seq > v_new_seq;

  update public.channel_members
  set last_read_seq = v_new_seq,
      unread_message_count = v_unread,
      last_read_update_at = (now() at time zone 'utc')
  where channel_id = p_channel_id and member_id = v_uid;

  -- Private topic `chatroom-read:{id}` gated by chatroom_read_topic_access
  -- on realtime.messages (members-only). The cursor write is the durable
  -- contract; broadcast failure (broker hiccup, missing extension) must
  -- not roll back the UPDATE.
  begin
    perform realtime.send(
      jsonb_build_object('user_id', v_uid, 'seq', v_new_seq),
      'read:advanced',
      'chatroom-read:' || p_channel_id,
      true
    );
  exception when others then
    raise warning 'read:advanced broadcast failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;

-- ---------------------------------------------------------------------------
-- Authorization for `chatroom-read:{channel_id}` private topic.
--   - Subscribers must be authenticated channel members (left_at IS NULL).
--   - `realtime.messages` RLS is already enabled by 07-3-notification-broadcast.
--   - 14-char prefix `chatroom-read:` -> substring starts at position 15.
-- ---------------------------------------------------------------------------

drop policy if exists "chatroom_read_topic_access" on realtime.messages;

create policy "chatroom_read_topic_access"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.topic like 'chatroom-read:%'
  and exists (
    select 1
    from public.channel_members cm
    where cm.channel_id = substr(realtime.messages.topic, 15)
      and cm.member_id  = (select auth.uid())
      and cm.left_at    is null
  )
);

comment on policy "chatroom_read_topic_access" on realtime.messages is
'Members-only subscription to chatroom-read:{channel_id}. Pairs with
advance_read_cursor which fans out read:advanced with private := TRUE.';
