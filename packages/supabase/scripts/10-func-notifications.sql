/*
 * Notification Management Functions
 * This file contains functions and triggers related to system notifications:
 * - Mention notifications (@user)
 * - Group notifications (@everyone)
 * - Regular message notifications
 * - Reaction notifications
 * - Unread message count tracking
 */

/**
 * Function: create_mention_notifications
 * Description: Creates notifications for users mentioned in a message with @username
 * Trigger: Executes after INSERT on public.messages when content contains '@'
 * Action: Creates notifications for each mentioned user who is a member of the channel
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_user_id UUID;
    is_channel_muted BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and notifications are not globally muted on the channel
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND THEN
        -- Channel does not exist
        RETURN NEW;
    END IF;

    IF is_channel_muted THEN
        -- Channel-level mute is enabled, no notifications
        RETURN NEW;
    END IF;

    -- 2) Verify that the sender exists (and is not deleted)
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        -- Sender does not exist
        RETURN NEW;
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) For each mentioned username, attempt to create a notification
    FOR mentioned_user_id IN
        SELECT u.id
          FROM public.users u
         WHERE NEW.content LIKE ('%@' || u.username || ' %')
            OR NEW.content LIKE ('%@' || u.username || '%')
    LOOP
        -- Check membership in the channel AND notification settings
        IF EXISTS (
            SELECT 1
              FROM public.channel_members
             WHERE channel_id = NEW.channel_id
               AND member_id  = mentioned_user_id
               AND mute_in_app_notifications = false
               AND notif_state != 'MUTED'
        ) THEN
            -- Insert the mention notification
            INSERT INTO public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            VALUES (
                mentioned_user_id,
                NEW.user_id,
                'mention',
                NEW.id,
                NEW.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_mention_notifications() IS 'Creates notifications for users who are mentioned with @username in a message.';

-- Trigger: create_mention_notifications
CREATE TRIGGER create_mention_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@%')
EXECUTE FUNCTION create_mention_notifications();

COMMENT ON TRIGGER create_mention_notifications ON public.messages IS 'Creates notifications for users mentioned with @username in a message.';

/**
 * Function: create_everyone_notifications
 * Description: Creates notifications for all channel members when @everyone is used
 * Trigger: Executes after INSERT on public.messages when content contains '@everyone'
 * Action: Creates notifications for all channel members except sender
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION create_everyone_notifications()
RETURNS TRIGGER AS $$
DECLARE
    channel_member_id UUID;
    is_channel_muted  BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and if it's globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW; -- Channel either doesn't exist or is muted globally
    END IF;

    -- 2) Verify the sender exists
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        RETURN NEW; -- Sender doesn't exist or is deleted
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) Check if the message contains "@everyone"
    IF NEW.content LIKE '%@everyone%' THEN
        -- 5) Loop over channel members (excluding sender) who have not muted notifications
        FOR channel_member_id IN
            SELECT cm.member_id
              FROM public.channel_members cm
             WHERE cm.channel_id = NEW.channel_id
               AND cm.member_id != NEW.user_id
               AND cm.mute_in_app_notifications = false
               AND cm.notif_state != 'MUTED'
        LOOP
            -- Insert the notification for each eligible member
            INSERT INTO public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            VALUES (
                channel_member_id,
                NEW.user_id,
                'channel_event',
                NEW.id,
                NEW.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_everyone_notifications() IS 'Creates notifications for all channel members when @everyone is used in a message.';

-- Trigger: create_everyone_notifications
CREATE TRIGGER create_everyone_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@everyone%')
EXECUTE FUNCTION create_everyone_notifications();

COMMENT ON TRIGGER create_everyone_notifications ON public.messages IS 'Creates notifications for all channel members when @everyone is used.';

/**
 * Function: create_regular_message_notifications
 * Description: Creates notifications for regular messages based on user preferences
 * Trigger: Executes after INSERT on public.messages
 * Action: Creates notifications for channel members who:
 *   - Have notifications enabled (notif_state = 'ALL')
 *   - Are not the sender
 *   - Are not currently online
 *   - Have not muted the channel
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION create_regular_message_notifications()
RETURNS TRIGGER AS $$
DECLARE
    is_channel_muted  BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and if it's globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW; -- Channel doesn't exist or is globally muted
    END IF;

    -- 2) Verify the sender still exists
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        RETURN NEW; -- Sender doesn't exist or is deleted
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) Create notifications only for members whose notif_state = 'ALL' and who are not online or the sender
    INSERT INTO public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    )
    SELECT
        cm.member_id,
        NEW.user_id,
        CASE
            WHEN NEW.thread_id IS NOT NULL THEN 'thread_message'::notification_category
            WHEN NEW.reply_to_message_id IS NOT NULL AND m.user_id = cm.member_id THEN 'reply'::notification_category
            ELSE 'message'::notification_category
        END,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.member_id
    LEFT JOIN public.messages m ON m.id = NEW.reply_to_message_id
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id  != NEW.user_id
      AND (u.status IS NULL OR u.status != 'ONLINE')
      AND cm.mute_in_app_notifications = FALSE
      AND cm.notif_state = 'ALL';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_regular_message_notifications() IS 'Creates notifications for regular messages based on user notification preferences.';

-- Trigger: create_regular_message_notifications
CREATE TRIGGER create_regular_message_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content NOT LIKE '%@%' OR NEW.content NOT LIKE '%@everyone%')
EXECUTE FUNCTION create_regular_message_notifications();

COMMENT ON TRIGGER create_regular_message_notifications ON public.messages IS 'Creates notifications for regular messages that don''t contain mentions.';

/**
 * Function: create_reaction_notifications
 * Description: Creates notifications for new reactions on messages
 * Trigger: Executes after UPDATE of reactions on public.messages
 * Action: Creates notifications for message owners when their messages receive reactions
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION create_reaction_notifications()
RETURNS TRIGGER AS $$
DECLARE
    old_reactions     JSONB;
    new_reactions     JSONB;
    reaction_key      TEXT;
    new_reaction      JSONB;
    sender_user_id    UUID;
    is_channel_muted  BOOLEAN;
BEGIN
    -- 1) Check if the channel is valid and if it's globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW; -- Channel doesn't exist or is globally muted
    END IF;

    -- 2) Verify the receiver (message owner) still exists
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = OLD.user_id
    ) THEN
        RETURN NEW; -- Receiver doesn't exist or is deleted
    END IF;

    -- 3) Ensure the message owner (receiver) has notif_state = 'ALL' and isn't muted in this channel
    IF NOT EXISTS (
        SELECT 1
          FROM public.channel_members cm
         WHERE cm.channel_id = NEW.channel_id
           AND cm.member_id  = OLD.user_id
           AND cm.mute_in_app_notifications = FALSE
           AND cm.notif_state = 'ALL'
    ) THEN
        RETURN NEW; -- User isn't configured to receive reaction notifications
    END IF;

    -- 4) Compare old and new reactions
    old_reactions := COALESCE(OLD.reactions, '{}'::jsonb);
    new_reactions := NEW.reactions;

    -- 5) Loop through each reaction type in the new reactions JSONB
    FOR reaction_key IN
        SELECT jsonb_object_keys(new_reactions)
    LOOP
        -- Loop through each new reaction for the current reaction_key
        FOR new_reaction IN
            SELECT jsonb_array_elements(new_reactions -> reaction_key)
        LOOP
            -- Extract the sender ID from the reaction
            sender_user_id := (new_reaction ->> 'user_id')::UUID;

            -- Check if this exact reaction was already present
            IF (old_reactions ? reaction_key)
               AND (old_reactions -> reaction_key) @> jsonb_build_array(new_reaction)
            THEN
                -- Reaction already exists, skip
                CONTINUE;
            ELSE
                -- Verify that the sender exists
                IF EXISTS (
                    SELECT 1
                      FROM public.users
                     WHERE id = sender_user_id
                ) THEN
                    -- Create a new reaction notification for the message owner
                    INSERT INTO public.notifications (
                        receiver_user_id,
                        sender_user_id,
                        type,
                        message_id,
                        channel_id,
                        message_preview,
                        created_at
                    )
                    VALUES (
                        OLD.user_id,
                        sender_user_id,
                        'reaction',
                        NEW.id,
                        NEW.channel_id,
                        COALESCE(truncate_content(NEW.content), ''),
                        timezone('utc', now())
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_reaction_notifications() IS 'Creates notifications for message owners when their messages receive new reactions.';

-- Trigger: create_reaction_notifications
CREATE TRIGGER create_reaction_notifications
AFTER UPDATE OF reactions ON public.messages
FOR EACH ROW
WHEN (OLD.reactions IS DISTINCT FROM NEW.reactions)
EXECUTE FUNCTION create_reaction_notifications();

COMMENT ON TRIGGER create_reaction_notifications ON public.messages IS 'Creates notifications when a message receives new reactions.';

/**
 * Function: increment_unread_count_on_new_message
 * Description: Increments unread message count for all workspace members
 * Trigger: Executes after INSERT on public.messages
 * Action: Increments unread_message_count for ALL workspace members except the message sender
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    workspace_id_var VARCHAR(36);
BEGIN
    -- Skip if message type is notification
    IF NEW.type = 'notification' THEN
        RETURN NEW;
    END IF;

    -- Get the workspace ID for the channel where the message was posted
    SELECT workspace_id INTO workspace_id_var
    FROM public.channels
    WHERE id = NEW.channel_id;

    -- If channel doesn't exist or has no workspace, exit early
    IF workspace_id_var IS NULL THEN
        RETURN NEW;
    END IF;

    -- First, ensure all workspace members have a channel_members entry
    -- If they don't, create one with unread_message_count = 1
    INSERT INTO public.channel_members (channel_id, member_id, unread_message_count, last_read_update_at)
    SELECT
        NEW.channel_id,
        wm.member_id,
        1,
        COALESCE((SELECT created_at FROM public.messages
                 WHERE channel_id = NEW.channel_id
                 ORDER BY created_at DESC
                 LIMIT 1 OFFSET 1),
                 timezone('utc', now()) - interval '1 second')
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_id_var
      AND wm.left_at IS NULL
      AND wm.member_id != NEW.user_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = NEW.channel_id
            AND cm.member_id = wm.member_id
      )
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    -- Then, increment unread message count for all existing channel members
    -- who are also active workspace members (excluding the sender)
    UPDATE public.channel_members cm
    SET unread_message_count = unread_message_count + 1
    FROM public.workspace_members wm
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id != NEW.user_id
      AND wm.workspace_id = workspace_id_var
      AND wm.member_id = cm.member_id
      AND wm.left_at IS NULL
      AND cm.last_read_update_at < NEW.created_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_unread_count_on_new_message() IS 'Increments unread message count for ALL workspace members (even non-channel members) upon insertion of a new message.';

-- Trigger: increment_unread_count
CREATE TRIGGER increment_unread_count
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count_on_new_message();

COMMENT ON TRIGGER increment_unread_count ON public.messages IS 'Increments the unread message count for all workspace members when a new message is posted.';

/**
 * Function: update_unread_count_on_message_delete
 * Description: Updates unread message counts when messages are deleted
 * Trigger: Executes after UPDATE of deleted_at or DELETE on public.messages
 * Action: Recalculates unread message counts based on remaining unread notifications
 * Returns: NULL (not used for AFTER triggers)
 */
CREATE OR REPLACE FUNCTION update_unread_count_on_message_delete() RETURNS TRIGGER AS $$
DECLARE
    channel_id_used VARCHAR(36);
BEGIN
    -- Determine whether it's a soft delete (update) or hard delete
    IF TG_OP = 'DELETE' THEN
        channel_id_used := OLD.channel_id;
    ELSE
        channel_id_used := NEW.channel_id;
    END IF;

    -- Update unread_message_count for all channel members in a single query
    UPDATE public.channel_members cm
    SET unread_message_count = sub.notification_count
    FROM (
        SELECT receiver_user_id AS member_id, COUNT(*) AS notification_count
        FROM public.notifications
        WHERE channel_id = channel_id_used AND readed_at IS NULL
        GROUP BY receiver_user_id
    ) sub
    WHERE cm.channel_id = channel_id_used AND cm.member_id = sub.member_id;

    RETURN NULL; -- Return value is not used for AFTER triggers
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_unread_count_on_message_delete() IS 'Updates unread message counts when messages are deleted, ensuring counts stay accurate.';

-- Trigger: update_unread_count_on_soft_delete
CREATE TRIGGER update_unread_count_on_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION update_unread_count_on_message_delete();

COMMENT ON TRIGGER update_unread_count_on_soft_delete ON public.messages IS 'Updates unread message counts when a message is soft-deleted.';

-- Trigger: update_unread_count_on_hard_delete
CREATE TRIGGER update_unread_count_on_hard_delete
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_unread_count_on_message_delete();

COMMENT ON TRIGGER update_unread_count_on_hard_delete ON public.messages IS 'Updates unread message counts when a message is hard-deleted.';
