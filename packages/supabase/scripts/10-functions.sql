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
    total_messages_since_last_read INT;
    last_read_message_id UUID;
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE;
    unread_message BOOLEAN := FALSE;
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

    -- Query for the last messages with user details, including replied message details
    SELECT json_agg(t) INTO messages_result
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
            END AS replied_message_details
        FROM public.messages m
        LEFT JOIN public.users u ON m.user_id = u.id
        WHERE m.channel_id = input_channel_id
            AND m.deleted_at IS NULL
            AND (
                CASE
                    WHEN total_messages_since_last_read < 20 THEN TRUE
                    ELSE m.created_at >= COALESCE(last_read_message_timestamp, 'epoch'::timestamp)
                END
            )
        ORDER BY m.created_at DESC
        LIMIT message_limit
    ) t;

    -- Query for the pinned messages
    SELECT json_agg(pm) INTO pinned_result
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
        last_read_message_timestamp;
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
    -- Check if the channel exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = input_channel_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Channel % does not exist or has been deleted.', input_channel_id;
    END IF;

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
                        ) FROM public.messages rm
                        LEFT JOIN public.users ru ON ru.id = rm.user_id
                        WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
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
