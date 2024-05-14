-- Test
-- SELECT * FROM get_channel_aggregate_data('99634205-5238-4ffc-90ec-c64be3ad25cf');
CREATE OR REPLACE FUNCTION get_channel_aggregate_data(
    input_channel_id VARCHAR(36),
    message_limit INT DEFAULT 20
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
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    channel_result JSONB;
    messages_result JSONB;
    pinned_result JSONB;
    is_member_result BOOLEAN;
    channel_member_info_result JSONB;
    last_read_message_id UUID;
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE;
    unread_message BOOLEAN := FALSE;
BEGIN
 
    -- Get the last_read_message_id for the current user in the channel
    SELECT cm.last_read_message_id INTO last_read_message_id
    FROM public.channel_members cm
    WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

    -- Get the timestamp of the last read message
    SELECT created_at INTO last_read_message_timestamp
    FROM public.messages
    WHERE id = last_read_message_id;

    -- Count messages since the last read message and adjust message_limit
    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages 
    WHERE channel_id = input_channel_id 
        AND created_at >= last_read_message_timestamp
        AND deleted_at IS NULL;

   IF total_messages_since_last_read >= message_limit THEN
        message_limit := total_messages_since_last_read;
        unread_message := TRUE;
    END IF;

    -- Query for channel information
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
    WHERE c.id = input_channel_id;

    -- Query for the last 10 messages with user details, including replied message details
    SELECT json_agg(t) INTO messages_result
    FROM (
        SELECT m.*,
            json_build_object(
                'id', u.id, 
                'username', u.username, 
                'fullname', u.full_name, 
                'avatar_url', u.avatar_url
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
                                'avatar_url', ru.avatar_url
                            )
                        ) FROM public.messages rm
                        LEFT JOIN public.users ru ON rm.user_id = ru.id
                        WHERE rm.id = m.reply_to_message_id)
                ELSE NULL
            END AS replied_message_details
        FROM public.messages m
        LEFT JOIN public.users u ON m.user_id = u.id
        WHERE m.channel_id = input_channel_id
            AND m.deleted_at IS NULL
            AND (
                CASE
                    WHEN total_messages_since_last_read < 20 THEN TRUE
                    ELSE m.created_at >= COALESCE(last_read_message_timestamp, 'epoch')
                END
            )
        ORDER BY m.created_at DESC
        LIMIT message_limit
    ) t;

    IF total_messages_since_last_read <= 0 THEN
        total_messages_since_last_read := message_limit;
    END IF;
        
    -- Query for the pinned messages
    SELECT json_agg(pm) INTO pinned_result
    FROM public.pinned_messages pm
    JOIN public.messages m ON pm.message_id = m.id
    WHERE pm.channel_id = input_channel_id;

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

    -- Return the results including the user data
    RETURN QUERY SELECT channel_result, messages_result, pinned_result, is_member_result, channel_member_info_result, total_messages_since_last_read, unread_message, last_read_message_id, last_read_message_timestamp;
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------
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
    -- Get the timestamp of the specified message
    SELECT created_at INTO target_timestamp
    FROM public.messages
    WHERE id = p_message_id;

    -- Check if the target_timestamp is valid (non-NULL)
    IF target_timestamp IS NOT NULL THEN
        -- Check if the given message ID is the last message in the channel by timestamp
        SELECT created_at = (SELECT MAX(created_at) FROM public.messages WHERE channel_id = p_channel_id)
        INTO is_last_message
        FROM public.messages
        WHERE id = p_message_id;

        -- Count the number of unread messages sent before or at the target timestamp, excluding those sent by the current user
        SELECT COUNT(*)
        INTO messages_to_mark_count
        FROM public.messages
        WHERE channel_id = p_channel_id
          AND user_id != auth.uid()
          AND created_at <= target_timestamp
          AND readed_at IS NULL;

        IF messages_to_mark_count > 0 THEN
            -- Update readed_at for these messages
            UPDATE public.messages
            SET readed_at = current_utc_timestamp
            WHERE channel_id = p_channel_id
              AND user_id != auth.uid()
              AND created_at <= target_timestamp
              AND readed_at IS NULL;

            -- Mark the notification as read
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
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


--------------------------------------------------

CREATE OR REPLACE FUNCTION get_channel_messages_paginated(
    input_channel_id VARCHAR(36),
    page INT,
    page_size INT DEFAULT 20 
)
RETURNS TABLE(
    messages JSONB
) AS $$
DECLARE
    message_offset INT; -- Renamed 'offset' to 'message_offset' to avoid keyword conflict
BEGIN
    -- Calculate the message_offset based on the page number and page size
    message_offset := (page - 1) * page_size;

    -- Query to fetch messages with pagination
    SELECT json_agg(t) INTO messages
    FROM (
        SELECT m.*,
            json_build_object(
                'id', u.id, 
                'username', u.username, 
                'fullname', u.full_name, 
                'avatar_url', u.avatar_url
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
                                'avatar_url', ru.avatar_url
                            )
                        ) FROM public.messages rm
                        LEFT JOIN public.users ru ON rm.user_id = ru.id
                        WHERE rm.id = m.reply_to_message_id)
                ELSE NULL
            END AS replied_message_details
        FROM public.messages m
        LEFT JOIN public.users u ON m.user_id = u.id
        WHERE m.channel_id = input_channel_id 
            AND m.deleted_at IS NULL 
        ORDER BY m.created_at DESC 
        LIMIT page_size OFFSET message_offset
    ) t;

    RETURN QUERY SELECT messages;
END;
$$ LANGUAGE plpgsql;


-- TEST
--- SELECT * FROM get_channel_messages_paginated('<channel_id>', 2, 10);


-------------------------------
-------------------------------
--- It's like a server function, and we do not concern ourselves with performance issues!
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
    current_user_id UUID := auth.uid();
    new_channel_id UUID := uuid_generate_v4();
    is_member BOOLEAN;
BEGIN
    -- Get the name of the user
    SELECT users.username, users.full_name, users.display_name, users.email
    INTO user_name, full_name, display_name, email
    FROM public.users WHERE users.id = user_id;

    -- Create display name based on the priority: display_name, full_name, username, email
    user_name := COALESCE(display_name, full_name, user_name, email);

    -- Check if the direct message channel already exists between the two users
    SELECT to_jsonb(ch.*) INTO existing_channel FROM public.channels ch
    WHERE ch.type = 'DIRECT'
    AND ch.workspace_id = workspace_uid
    AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = ch.id
        AND cm.member_id IN (current_user_id, user_id)
        GROUP BY cm.channel_id
        HAVING COUNT(DISTINCT cm.member_id) = 2
    );

    -- If the channel already exists, return it
    IF existing_channel IS NOT NULL THEN
        RETURN existing_channel;
    END IF;

    -- Otherwise, create a new channel
    INSERT INTO public.channels (id, workspace_id, type, name, slug, created_by)
    VALUES (new_channel_id, workspace_uid, 'DIRECT', user_name, uuid_generate_v4(), current_user_id)
    RETURNING to_jsonb(public.channels.*) INTO new_channel;

    -- Check if the current user is already a member of the new channel
    SELECT EXISTS (
        SELECT 1 FROM public.channel_members WHERE channel_id = new_channel_id AND member_id = current_user_id
    ) INTO is_member;

    IF NOT is_member THEN
        INSERT INTO public.channel_members (channel_id, member_id, joined_at)
        VALUES (new_channel_id, current_user_id, now());
    END IF;

    -- Check if the other user is already a member of the new channel
    SELECT EXISTS (
        SELECT 1 FROM public.channel_members WHERE channel_id = new_channel_id AND member_id = user_id
    ) INTO is_member;

    IF NOT is_member THEN
        INSERT INTO public.channel_members (channel_id, member_id, joined_at)
        VALUES (new_channel_id, user_id, now());
    END IF;

    RETURN new_channel;
END;
$$ LANGUAGE plpgsql;
