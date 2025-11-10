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
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE
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
    unread_message BOOLEAN := FALSE;
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE;
    half_limit INT;
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

    IF channel_result IS NULL THEN
        RAISE EXCEPTION 'Channel % does not exist or has been deleted.', input_channel_id;
    END IF;

    -- Attempt to get channel member details
    SELECT json_build_object(
            'last_read_message_id', cm.last_read_message_id,
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

    -- Get the last_read_message_id and timestamp for the current user in the channel
    IF is_member_result THEN
        SELECT cm.last_read_message_id INTO last_read_message_id
        FROM public.channel_members cm
        WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

        -- Get the timestamp of the last read message
        IF last_read_message_id IS NOT NULL THEN
            SELECT created_at INTO last_read_message_timestamp
            FROM public.messages
            WHERE id = last_read_message_id AND deleted_at IS NULL;
        END IF;
    END IF;

    -- Count messages since the last read message
    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages
    WHERE channel_id = input_channel_id
        AND deleted_at IS NULL
        AND created_at > COALESCE(last_read_message_timestamp, 'epoch'::timestamp);

    IF total_messages_since_last_read >= message_limit THEN
        message_limit := total_messages_since_last_read;
        unread_message := TRUE;
    END IF;

    -- If anchor_message_id is provided, get its timestamp
    IF anchor_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = anchor_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NULL THEN
            RAISE EXCEPTION 'Anchor message % does not exist or has been deleted.', anchor_message_id;
        END IF;
    END IF;

    -- Query for the messages with user details, including replied message details
    -- Logic differs based on whether anchor_message_id is provided
    IF anchor_message_id IS NULL THEN
        -- Standard logic without anchor (unchanged)
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
                -- Bookmark information
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
                AND (
                    CASE
                        WHEN total_messages_since_last_read < 20 THEN TRUE
                        ELSE m.created_at >= COALESCE(last_read_message_timestamp, 'epoch'::timestamp)
                    END
                )
            ORDER BY m.created_at DESC
            LIMIT message_limit
        ) t;
    ELSE
        -- Anchor-based logic: get messages around the anchor message
        -- Split the limit to get messages before and after the anchor
        half_limit := GREATEST(message_limit / 2, 1);

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
            ORDER BY m.created_at DESC
            LIMIT half_limit
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
            ORDER BY m.created_at ASC
            LIMIT message_limit - half_limit
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
            ORDER BY created_at DESC
            LIMIT message_limit
        ) cm;
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
        anchor_message_timestamp;
END;
$$ LANGUAGE plpgsql;
--------------------------------------------------
--------------------------------------------------
--------------------------------------------------
CREATE OR REPLACE FUNCTION get_channel_messages_paginated(
    input_channel_id   VARCHAR(36),
    limit_count        INT                DEFAULT 20,
    cursor_timestamp   TIMESTAMPTZ        DEFAULT NULL,
    direction          VARCHAR(10)        DEFAULT 'older'  -- 'older' or 'newer'
)
RETURNS TABLE(
    messages            JSONB,
    pagination_cursors  JSONB
) AS $$
BEGIN
    -- 1) Validation
    IF limit_count <= 0 THEN
        RAISE EXCEPTION 'limit_count must be > 0';
    END IF;
    IF direction NOT IN ('older','newer') THEN
        RAISE EXCEPTION 'direction must be "older" or "newer"';
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM public.channels
         WHERE id = input_channel_id
           AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Channel % does not exist or is deleted', input_channel_id;
    END IF;

    -- 2) Branch on direction for ordering & cursor logic
    IF direction = 'older' THEN

        WITH paged AS (
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
            WHERE
              m.channel_id = input_channel_id
              AND m.deleted_at IS NULL
              AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND ( cursor_timestamp IS NULL OR m.created_at < cursor_timestamp )
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT limit_count
        )
        SELECT
          COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb) AS messages,
          jsonb_build_object(
            'older_cursor', MIN(created_at),
            'newer_cursor', MAX(created_at),
            'has_more_older',
              EXISTS(
                SELECT 1
                  FROM public.messages
                 WHERE channel_id = input_channel_id
                   AND deleted_at IS NULL
                   AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
                   AND created_at < MIN(paged.created_at)
              ),
            'has_more_newer',
              EXISTS(
                SELECT 1
                  FROM public.messages
                 WHERE channel_id = input_channel_id
                   AND deleted_at IS NULL
                   AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
                   AND created_at > MAX(paged.created_at)
              )
          ) AS pagination_cursors
        INTO messages, pagination_cursors
        FROM paged;

    ELSE  -- direction = 'newer'

        WITH paged AS (
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
            WHERE
              m.channel_id = input_channel_id
              AND m.deleted_at IS NULL
              AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND ( cursor_timestamp IS NULL OR m.created_at > cursor_timestamp )
            ORDER BY m.created_at  ASC, m.id  ASC
            LIMIT limit_count
        )
        SELECT
          COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb) AS messages,
          jsonb_build_object(
            'older_cursor', MIN(created_at),
            'newer_cursor', MAX(created_at),
            'has_more_older',
              EXISTS(
                SELECT 1
                  FROM public.messages
                 WHERE channel_id = input_channel_id
                   AND deleted_at IS NULL
                   AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
                   AND created_at < MIN(paged.created_at)
              ),
            'has_more_newer',
              EXISTS(
                SELECT 1
                  FROM public.messages
                 WHERE channel_id = input_channel_id
                   AND deleted_at IS NULL
                   AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
                   AND created_at > MAX(paged.created_at)
              )
          ) AS pagination_cursors
        INTO messages, pagination_cursors
        FROM paged;

    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;
--------------------------------------------------
--------------------------------------------------
--------------------------------------------------
-- p_message_id =: is the last message inserted in the channel
CREATE OR REPLACE FUNCTION mark_messages_as_read(
    p_channel_id VARCHAR(36),
    p_message_id UUID
)
RETURNS VOID AS $$
DECLARE
    current_utc_timestamp TIMESTAMP WITH TIME ZONE := timezone('utc', now());
    target_timestamp TIMESTAMP WITH TIME ZONE;
    is_last_message BOOLEAN;
    messages_to_mark_count INT;
BEGIN
    -- Check if the channel exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Channel % does not exist or has been deleted.', p_channel_id;
    END IF;

    -- Check if the message exists and is not deleted
    SELECT created_at INTO target_timestamp
    FROM public.messages
    WHERE id = p_message_id AND deleted_at IS NULL;

    IF target_timestamp IS NULL THEN
        RAISE EXCEPTION 'Message % does not exist or has been deleted.', p_message_id;
    END IF;

    -- Ensure the user is a member of the channel
    IF NOT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = p_channel_id AND member_id = auth.uid()) THEN
        RAISE EXCEPTION 'User % is not a member of channel %.', auth.uid(), p_channel_id;
    END IF;

    -- Check if the given message ID is the last message in the channel by timestamp
    SELECT created_at = (SELECT MAX(created_at) FROM public.messages WHERE channel_id = p_channel_id AND deleted_at IS NULL)
    INTO is_last_message
    FROM public.messages
    WHERE id = p_message_id AND deleted_at IS NULL;

    -- Count the number of unread messages sent before or at the target timestamp, excluding those sent by the current user
    SELECT COUNT(*)
    INTO messages_to_mark_count
    FROM public.messages
    WHERE channel_id = p_channel_id
      AND user_id != auth.uid()
      AND created_at <= target_timestamp
      AND readed_at IS NULL
      AND deleted_at IS NULL;

    IF messages_to_mark_count > 0 THEN
        -- Update readed_at for these messages
        UPDATE public.messages
        SET readed_at = current_utc_timestamp
        WHERE channel_id = p_channel_id
          AND user_id != auth.uid()
          AND created_at <= target_timestamp
          AND readed_at IS NULL
          AND deleted_at IS NULL;

        -- Mark the notifications as read
        UPDATE public.notifications
        SET readed_at = current_utc_timestamp
        WHERE channel_id = p_channel_id
          AND receiver_user_id = auth.uid()
          AND message_id = p_message_id
          AND readed_at IS NULL;
    END IF;

    -- Update the last_read_message_id and adjust the unread_message_count
    UPDATE public.channel_members
    SET last_read_message_id = p_message_id,
        last_read_update_at = current_utc_timestamp,
        unread_message_count = CASE WHEN is_last_message THEN 0 ELSE GREATEST(unread_message_count - messages_to_mark_count, 0) END
    WHERE channel_id = p_channel_id AND member_id = auth.uid();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-------------------------------
-------------------------------
-- It's like a server function, and we do not concern ourselves with performance issues!
CREATE OR REPLACE FUNCTION create_direct_message_channel(
    workspace_uid VARCHAR(36),
    user_id UUID
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;


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
            JOIN public.channels      AS c ON c.id = n.channel_id
            LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
            WHERE n.receiver_user_id = auth.uid()
              AND n.readed_at IS NULL
              -- If _type is NULL, allow any type. Otherwise, match it.
              AND (
                _type IS NULL
                OR n.type::text = _type
              )
              -- If _workspace_id is NULL, no workspace filter; otherwise match.
              AND (
                _workspace_id IS NULL
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
-- Function to add the current user to a workspace
CREATE OR REPLACE FUNCTION join_workspace(
    _workspace_id VARCHAR(36)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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
