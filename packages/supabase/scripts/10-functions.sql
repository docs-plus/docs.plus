-- Test
-- SELECT * FROM get_channel_aggregate_data('99634205-5238-4ffc-90ec-c64be3ad25cf');

-- Helper function to get standardized user details as JSON
CREATE OR REPLACE FUNCTION user_details_json(u public.users)
RETURNS JSONB AS $$
BEGIN
  RETURN json_build_object(
    'id', u.id,
    'username', u.username,
    'fullname', u.full_name,
    'avatar_url', u.avatar_url,
    'avatar_updated_at', u.avatar_updated_at
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION user_details_json(public.users) IS
'Returns a standardized JSON object with user details. Immutable function
for consistent user representation across different contexts.';

-- Drop the existing function first to allow changing the return type
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
    SELECT MAX(cm.last_read_seq) INTO peer_max_read_seq_result
    FROM public.channel_members cm
    WHERE cm.channel_id = input_channel_id
      AND cm.member_id <> auth.uid()
      AND cm.left_at IS NULL;

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
-------------------------------
-------------------------------
-- SECURITY DEFINER: the function needs to read u.email (column-revoked
-- from authenticated in 13-RLS.sql) and to insert a channel_members row
-- for `user_id != auth.uid()` (blocked by channel_members_join_insert).
-- Both are intended bypasses for the DM-create flow; auth.uid()-based
-- checks inside the function body enforce the actual authorisation.
CREATE OR REPLACE FUNCTION create_direct_message_channel(
    workspace_uid VARCHAR(36),
    user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name TEXT;
    display_name TEXT;
    full_name TEXT;
    email TEXT;
    new_channel JSONB;
    existing_channel JSONB;
    current_user_id UUID;
    new_channel_id UUID := uuid_generate_v4();
BEGIN
    -- Ensure user_id (the other user) is not NULL
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Parameter user_id cannot be NULL.';
    END IF;

    -- Get current user ID from auth.uid(), or from app.current_user_id if auth.uid() is NULL
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        -- Attempt to get current_user_id from session variable for testing purposes
        BEGIN
            SELECT current_setting('app.current_user_id', TRUE) INTO current_user_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Current user ID is NULL or not set.';
        END;
    END IF;

    -- Check if current_user_id is still NULL
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Current user ID is NULL.';
    END IF;

    -- Check if the workspace exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_uid AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Workspace % does not exist or has been deleted.', workspace_uid;
    END IF;

    -- Check if the other user exists and is not deleted
    SELECT u.username, u.full_name, u.display_name, u.email
    INTO user_name, full_name, display_name, email
    FROM public.users u
    WHERE u.id = user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not exist or has been deleted.', user_id;
    END IF;

    -- Check if the current user exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
        RAISE EXCEPTION 'Current user % does not exist or has been deleted.', current_user_id;
    END IF;

    -- Prevent creating a channel with oneself
    IF current_user_id = user_id THEN
        RAISE EXCEPTION 'Cannot create a direct message channel with oneself.';
    END IF;

    -- Create display name based on the priority: display_name, full_name, username, email
    user_name := COALESCE(display_name, full_name, user_name, email);

    -- Check if the direct message channel already exists between the two users
    SELECT to_jsonb(ch.*) INTO existing_channel
    FROM public.channels ch
    JOIN public.channel_members cm1 ON cm1.channel_id = ch.id AND cm1.member_id = current_user_id
    JOIN public.channel_members cm2 ON cm2.channel_id = ch.id AND cm2.member_id = user_id
    WHERE ch.type = 'DIRECT'
      AND ch.workspace_id = workspace_uid
      AND ch.deleted_at IS NULL
      AND cm1.left_at IS NULL
      AND cm2.left_at IS NULL;

    -- If the channel already exists, return it
    IF existing_channel IS NOT NULL THEN
        RETURN existing_channel;
    END IF;

    -- Otherwise, create a new channel
    INSERT INTO public.channels (id, workspace_id, type, name, slug, created_by)
    VALUES (new_channel_id, workspace_uid, 'DIRECT', user_name, uuid_generate_v4(), current_user_id)
    RETURNING to_jsonb(public.channels.*) INTO new_channel;

    -- Add current user to the channel
    -- INSERT INTO public.channel_members (channel_id, member_id, joined_at)
    -- VALUES (new_channel_id, current_user_id, now());

    -- Add the other user to the channel
    INSERT INTO public.channel_members (channel_id, member_id, joined_at)
    VALUES (new_channel_id, user_id, now());

    RETURN new_channel;
END;
$$;


---------------------
CREATE OR REPLACE FUNCTION public.notifications_summary(
    _workspace_id VARCHAR(36) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_unread_count          BIGINT;
    v_unread_mention_count  BIGINT;
    v_last_unread           JSONB;
    v_last_unread_mention   JSONB;
BEGIN
    /*
       If _workspace_id is not NULL, filter notifications by channels in that workspace.
       Otherwise, no workspace filter.
    */

    -- 1) Count all unread notifications
    SELECT COUNT(*)
    INTO v_unread_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 2) Count all unread "mention" notifications
    SELECT COUNT(*)
    INTO v_unread_mention_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.type = 'mention'
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 3) Last 6 unread notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    -- 4) Last 6 unread "mention" notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread_mention
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.type = 'mention'
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    RETURN JSONB_BUILD_OBJECT(
        'unread_count',         v_unread_count,
        'unread_mention_count', v_unread_mention_count,
        'last_unread',         COALESCE(v_last_unread, '[]'::JSONB),
        'last_unread_mention', COALESCE(v_last_unread_mention, '[]'::JSONB)
    );
END;
$$;
-----------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_notifications_paginated(
    _workspace_id VARCHAR(36) DEFAULT NULL,
    _type         TEXT        DEFAULT NULL,
    _page         INT         DEFAULT 1,
    _page_size    INT         DEFAULT 6
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset INT := (_page - 1) * _page_size;
BEGIN
    RETURN QUERY
        SELECT to_jsonb(sub.*)
        FROM (
            SELECT
                n.id,
                n.type,
                n.message_id,
                n.channel_id,
                n.message_preview,
                n.action_url,
                n.created_at,
                JSON_BUILD_OBJECT(
                    'id',               u.id,
                    'username',         u.username,
                    'full_name',        u.full_name,
                    'avatar_url',       u.avatar_url,
                    'display_name',     u.display_name,
                    'avatar_updated_at',u.avatar_updated_at
                ) AS sender
            FROM public.notifications AS n
            LEFT JOIN public.channels AS c ON c.id = n.channel_id
            LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
            WHERE n.receiver_user_id = auth.uid()
              AND n.readed_at IS NULL
              -- If _type is NULL, allow any type. Otherwise, match it.
              AND (
                _type IS NULL
                OR n.type::text = _type
              )
              -- If _workspace_id is NULL, no workspace filter; otherwise match.
              -- System notifications (no channel) are always included.
              AND (
                _workspace_id IS NULL
                OR n.channel_id IS NULL
                OR c.workspace_id = _workspace_id
              )
            ORDER BY n.created_at DESC
            LIMIT _page_size
            OFFSET v_offset
        ) AS sub;
END;
$$;

-------------------------

CREATE OR REPLACE FUNCTION public.fetch_mentioned_users(
  _workspace_id VARCHAR,
  _username TEXT
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  avatar_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Authorization: workspace mention lists must not enumerate users
  -- across workspaces. Caller must be an active workspace member.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.member_id    = auth.uid()
      AND wm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', _workspace_id;
  END IF;

  IF _username IS NULL OR _username = '' THEN
    -- If no username is provided, return the 6 most recent users
    RETURN QUERY
      SELECT DISTINCT
             u.id,
             u.username,
             u.full_name,
             u.display_name,
             u.avatar_url,
             u.avatar_updated_at,
             u.created_at
        FROM public.users u
        JOIN public.channel_members cm ON cm.member_id = u.id
        JOIN public.channels c        ON c.id = cm.channel_id
       WHERE c.workspace_id = _workspace_id
         AND u.deleted_at IS NULL
         AND u.username != 'system'
       ORDER BY u.created_at DESC
       LIMIT 6;

  ELSE
    -- If a username is provided, perform a partial match
    RETURN QUERY
      SELECT DISTINCT
             u.id,
             u.username,
             u.full_name,
             u.display_name,
             u.avatar_url,
             u.avatar_updated_at,
             u.created_at
        FROM public.users u
        JOIN public.channel_members cm ON cm.member_id = u.id
        JOIN public.channels c        ON c.id = cm.channel_id
       WHERE c.workspace_id = _workspace_id
         AND u.deleted_at IS NULL
         AND u.username != 'system'
         AND u.username ILIKE '%' || _username || '%'
       ORDER BY u.username
       LIMIT 10;
  END IF;
END;
$$;


-----------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_notif_count(
    _workspace_id VARCHAR(36) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_unread_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_unread_count
    FROM public.notifications AS n
    JOIN public.channels AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    RETURN v_unread_count;
END;
$$;

-- ALTER FUNCTION public.get_unread_notif_count(VARCHAR(36))
-- SET parallel_safe = true;

-----------------------------------
CREATE OR REPLACE FUNCTION public.get_channel_notif_state(
  _channel_id VARCHAR(36)
)
RETURNS public.channel_notification_state
LANGUAGE plpgsql
AS $$
DECLARE
    v_notif_state public.channel_notification_state;
BEGIN
    SELECT notif_state
    INTO v_notif_state
    FROM public.channel_members cm
   WHERE cm.channel_id = _channel_id
     AND cm.member_id = auth.uid()
   LIMIT 1;

    RETURN v_notif_state;
END;
$$;

-----------------------------------
-- Function to add the current user to a workspace.
--
-- Product invariant: docs.plus workspaces are document slugs. Opening any
-- doc auto-bootstraps the workspace (creates if missing) and joins the
-- caller. Membership is intentionally self-service — there is no invite
-- gate. Workspace isolation is therefore "anyone signed in can see any
-- workspace's PUBLIC content" by design; PRIVATE channels still require
-- per-channel membership (`channels_member_insert` in 13-RLS.sql).
CREATE OR REPLACE FUNCTION join_workspace(
    _workspace_id VARCHAR(36)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the current user ID
    user_id := auth.uid();

    -- Check if the user ID is valid
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. User ID is NULL.';
    END IF;

    -- Check if the workspace exists and is not deleted, create if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = _workspace_id AND deleted_at IS NULL
    ) THEN
        -- Create the workspace with the given ID
        INSERT INTO public.workspaces (id, name, slug, created_by)
        VALUES (_workspace_id, _workspace_id, lower(_workspace_id), user_id);
    END IF;

    -- Check if user is already a member of this workspace
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = _workspace_id AND member_id = user_id
    ) THEN
        -- Return true if the user is already a member
        RETURN TRUE;
    END IF;

    -- Insert new workspace member record
    INSERT INTO public.workspace_members (workspace_id, member_id)
    VALUES (_workspace_id, user_id);

        -- For new workspace members, create channel_members entries for all channels in this workspace
    -- Use a single INSERT with CTEs for optimal performance
    INSERT INTO public.channel_members (
        channel_id,
        member_id,
        unread_message_count,
        last_read_message_id,
        last_read_update_at
    )
    WITH channel_data AS (
        SELECT
            cmc.channel_id,
            cmc.message_count,
            c.created_at as channel_created_at
        FROM public.channel_message_counts cmc
        JOIN public.channels c ON c.id = cmc.channel_id
        WHERE cmc.workspace_id = _workspace_id
          AND c.deleted_at IS NULL
    ),
    first_messages AS (
        SELECT DISTINCT ON (m.channel_id)
            m.channel_id,
            m.id as first_message_id
        FROM public.messages m
        WHERE m.channel_id IN (SELECT channel_id FROM channel_data)
          AND m.deleted_at IS NULL
        ORDER BY m.channel_id, m.created_at ASC
    )
    SELECT
        cd.channel_id,
        user_id,
        cd.message_count,
        fm.first_message_id,
        cd.channel_created_at
    FROM channel_data cd
    LEFT JOIN first_messages fm ON fm.channel_id = cd.channel_id
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION join_workspace(VARCHAR(36)) IS
'Adds the currently authenticated user to the specified workspace.
Returns TRUE if successful or if user is already a member.';

-----------------------------------
-- Function to get channel members by last read update timestamp
CREATE OR REPLACE FUNCTION public.get_channel_members_by_last_read_update(
    _channel_id VARCHAR(36),
    _timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    avatar_updated_at TIMESTAMP WITH TIME ZONE,
    avatar_url TEXT,
    display_name TEXT,
    full_name TEXT,
    last_read_update_at TIMESTAMP WITH TIME ZONE,
    username TEXT,
    user_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Validate input parameters
    IF _channel_id IS NULL THEN
        RAISE EXCEPTION 'channel_id cannot be NULL';
    END IF;

    IF _timestamp IS NULL THEN
        RAISE EXCEPTION 'timestamp cannot be NULL';
    END IF;

    -- Check if channel exists and is not deleted
    IF NOT EXISTS (
        SELECT 1 FROM public.channels
        WHERE id = _channel_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Channel % does not exist or has been deleted', _channel_id;
    END IF;

    -- Authorization: read-receipts are not public-readable, even on
    -- PUBLIC channels. Members only.
    IF NOT EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = _channel_id
          AND cm.member_id  = auth.uid()
          AND cm.left_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of channel %.', _channel_id;
    END IF;

    RETURN QUERY
    SELECT
        u.avatar_updated_at,
        u.avatar_url,
        u.display_name,
        u.full_name,
        cm.last_read_update_at,
        u.username,
        u.id
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.member_id
    WHERE cm.channel_id = _channel_id
      AND cm.last_read_update_at >= _timestamp
      AND u.deleted_at IS NULL
      AND cm.left_at IS NULL  -- Only active members
    ORDER BY cm.last_read_update_at DESC, u.username ASC;
END;
$$;

COMMENT ON FUNCTION public.get_channel_members_by_last_read_update(VARCHAR(36), TIMESTAMP WITH TIME ZONE) IS
'Returns channel members whose last_read_update_at is equal to or greater than the specified timestamp.
Only returns active members (not left) and non-deleted users.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.user_details_json(u users) SET search_path = public;
ALTER FUNCTION public.get_channel_aggregate_data(input_channel_id character varying, message_limit integer, anchor_message_id uuid) SET search_path = public;
ALTER FUNCTION public.create_direct_message_channel(workspace_uid character varying, user_id uuid) SET search_path = public;
ALTER FUNCTION public.notifications_summary(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_unread_notifications_paginated(_workspace_id character varying, _type text, _page integer, _page_size integer) SET search_path = public;
ALTER FUNCTION public.fetch_mentioned_users(_workspace_id character varying, _username text) SET search_path = public;
ALTER FUNCTION public.get_unread_notif_count(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_channel_notif_state(_channel_id character varying) SET search_path = public;
ALTER FUNCTION public.join_workspace(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_channel_members_by_last_read_update(_channel_id character varying, _timestamp timestamp with time zone) SET search_path = public;

-- ============================================================
-- v2 chatroom RPCs (paired with migrations 20260513140500..20260513142000).
-- ============================================================

-- fetch_message_window: anchor-aware window. Four anchor kinds:
--   'tail', 'first_unread', 'message_id' (raises 42501 if forbidden),
--   'before_seq' (loadOlder cursor). Returns
--   { rows, anchor_seq, has_more_before, has_more_after }.
create or replace function public.fetch_message_window(
  p_channel_id   varchar(36),
  p_anchor_kind  text,
  p_anchor_value text default null,
  p_before_limit int default 40,
  p_after_limit  int default 40
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_anchor_seq bigint;
  -- v_anchor_seq drives the local before/after window query; v_response_anchor
  -- is what the FE sees. They diverge for 'first_unread' when no real unread
  -- exists (anon viewers, or authed users caught up to tail) — we still need
  -- a seq to center the window on (tail), but the FE must NOT render the
  -- "Unread messages" sentinel since there's nothing to flag.
  v_response_anchor bigint;
  v_rows jsonb;
  v_has_more_before boolean;
  v_has_more_after boolean;
  v_target_msg_id uuid;
  v_target_channel varchar(36);
begin
  if p_anchor_kind = 'tail' then
    select coalesce(max(seq), 0) into v_anchor_seq
    from public.messages
    where channel_id = p_channel_id and deleted_at is null;
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'first_unread' then
    if v_uid is null then
      -- Anon has no per-user read cursor; window around tail but null out
      -- the response anchor so the FE skips the sentinel.
      select coalesce(max(seq), 0) into v_anchor_seq
      from public.messages
      where channel_id = p_channel_id and deleted_at is null;
      v_response_anchor := null;
    else
      select min(m.seq) into v_anchor_seq
      from public.messages m
      join public.channel_members cm on cm.channel_id = m.channel_id
      where m.channel_id = p_channel_id
        and m.deleted_at is null
        and cm.member_id = v_uid
        and m.seq > cm.last_read_seq;
      if v_anchor_seq is null then
        -- Authed user is caught up; same treatment as anon.
        select coalesce(max(seq), 0) into v_anchor_seq
        from public.messages
        where channel_id = p_channel_id and deleted_at is null;
        v_response_anchor := null;
      else
        v_response_anchor := v_anchor_seq;
      end if;
    end if;

  elsif p_anchor_kind = 'message_id' then
    v_target_msg_id := p_anchor_value::uuid;
    select channel_id, seq into v_target_channel, v_anchor_seq
    from public.messages
    where id = v_target_msg_id and deleted_at is null;
    if v_target_channel is null or v_target_channel <> p_channel_id then
      raise exception 'message not found or not in channel' using errcode = '42501';
    end if;
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'before_seq' then
    v_anchor_seq := (p_anchor_value::bigint) - 1;
    v_response_anchor := v_anchor_seq;
    -- Inline json_build_object instead of public.user_details_json(u): the
    -- composite-row form requires SELECT on every users column (including
    -- `email`, which is excluded from anon + authenticated column grants),
    -- so security-invoker callers get "permission denied for table users".
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
          and m.seq < (p_anchor_value::bigint)
        order by m.seq desc
        limit p_before_limit
      ) t;
    v_has_more_before := exists (
      select 1 from public.messages
      where channel_id = p_channel_id and deleted_at is null
        and seq < coalesce(
          (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
          (p_anchor_value::bigint)
        )
    );
    v_has_more_after := true;
    return jsonb_build_object(
      'rows', v_rows,
      'anchor_seq', v_response_anchor,
      'has_more_before', v_has_more_before,
      'has_more_after', v_has_more_after
    );

  else
    raise exception 'invalid anchor_kind: %', p_anchor_kind using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  into v_rows
  from (
    (
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
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq <= v_anchor_seq
      order by m.seq desc limit p_before_limit + 1
    )
    union all
    (
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
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq > v_anchor_seq
      order by m.seq asc limit p_after_limit
    )
  ) t;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq < coalesce(
        (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq + 1
      )
  ) into v_has_more_before;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq > coalesce(
        (select max((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq - 1
      )
  ) into v_has_more_after;

  return jsonb_build_object(
    'rows', v_rows,
    'anchor_seq', v_response_anchor,
    'has_more_before', v_has_more_before,
    'has_more_after', v_has_more_after
  );
end;
$$;

grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;

-- fetch_messages_since: connection-event refetch. Returns a jsonb array of
-- message rows (each row enriched with user_details via user_details_json)
-- with seq > p_since_seq, ordered ascending. Returning jsonb instead of
-- setof public.messages lets us inline user_details for display parity
-- with fetch_message_window without changing the base messages rowtype.
drop function if exists public.fetch_messages_since(varchar, bigint, int);
create or replace function public.fetch_messages_since(
  p_channel_id varchar(36),
  p_since_seq  bigint,
  p_limit      int default 100
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
    order by m.seq asc
    limit p_limit
  ) t;
$$;

grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;

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

  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid;

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

  -- Fan out to peers so sender-side check-marks flip without subscribing
  -- to channel_members postgres_changes (workspace-scoped to own rows in
  -- useCatchUserPresences). The cursor write is the durable contract;
  -- the broadcast is a hint, so a realtime.send failure (broker hiccup,
  -- missing extension on a fresh deploy) must not roll back the UPDATE.
  begin
    perform realtime.send(
      jsonb_build_object('user_id', v_uid, 'seq', v_new_seq),
      'read:advanced',
      'chatroom:' || p_channel_id,
      false
    );
  exception when others then
    raise warning 'read:advanced broadcast failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;
