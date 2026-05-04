-- Adds pagination cursor outputs to get_channel_aggregate_data so the
-- chatroom client can boot pagination state from the same RPC payload.
-- Mirrors packages/supabase/scripts/10-functions.sql.
--
-- The return type changes (4 new columns), so DROP first; CREATE OR REPLACE
-- alone cannot widen the RETURNS TABLE signature in place.

DROP FUNCTION IF EXISTS public.get_channel_aggregate_data(VARCHAR(36), INT, UUID);

CREATE OR REPLACE FUNCTION public.get_channel_aggregate_data(
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
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE,
    older_cursor TIMESTAMP WITH TIME ZONE,
    newer_cursor TIMESTAMP WITH TIME ZONE,
    has_more_older BOOLEAN,
    has_more_newer BOOLEAN
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
    older_cursor_result TIMESTAMP WITH TIME ZONE;
    newer_cursor_result TIMESTAMP WITH TIME ZONE;
    has_more_older_result BOOLEAN := FALSE;
    has_more_newer_result BOOLEAN := FALSE;
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

    is_member_result := (channel_member_info_result IS NOT NULL);

    IF is_member_result THEN
        SELECT cm.last_read_message_id INTO last_read_message_id
        FROM public.channel_members cm
        WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

        IF last_read_message_id IS NOT NULL THEN
            SELECT created_at INTO last_read_message_timestamp
            FROM public.messages
            WHERE id = last_read_message_id AND deleted_at IS NULL;
        END IF;
    END IF;

    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages
    WHERE channel_id = input_channel_id
        AND deleted_at IS NULL
        AND created_at > COALESCE(last_read_message_timestamp, 'epoch'::timestamp);

    IF total_messages_since_last_read >= message_limit THEN
        message_limit := total_messages_since_last_read;
        unread_message := TRUE;
    END IF;

    IF anchor_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = anchor_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NULL THEN
            RAISE EXCEPTION 'Anchor message % does not exist or has been deleted.', anchor_message_id;
        END IF;
    END IF;

    IF anchor_message_id IS NULL THEN
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
                AND (
                    CASE
                        WHEN total_messages_since_last_read < 20 THEN TRUE
                        ELSE m.created_at >= COALESCE(last_read_message_timestamp, 'epoch'::timestamp)
                    END
                )
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT message_limit
        ) t;
    ELSE
        half_limit := GREATEST(message_limit / 2, 1);

        WITH messages_before AS (
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
                AND m.created_at <= anchor_message_timestamp
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT half_limit
        ),
        messages_after AS (
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
                AND m.created_at > anchor_message_timestamp
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT message_limit - half_limit
        ),
        combined_messages AS (
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

    SELECT COALESCE(json_agg(pm), '[]'::json) INTO pinned_result
    FROM public.pinned_messages pm
    JOIN public.messages m ON pm.message_id = m.id
    WHERE pm.channel_id = input_channel_id
      AND m.deleted_at IS NULL;

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
        anchor_message_timestamp,
        older_cursor_result,
        newer_cursor_result,
        has_more_older_result,
        has_more_newer_result;
END;
$$ LANGUAGE plpgsql STABLE;
