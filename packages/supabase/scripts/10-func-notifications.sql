CREATE OR REPLACE FUNCTION create_notifications_for_mentions()
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

CREATE TRIGGER trigger_on_new_message_for_mention_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@%')
EXECUTE FUNCTION create_notifications_for_mentions();

--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

-- Function to handle '@everyone' notifications
CREATE OR REPLACE FUNCTION create_notifications_for_everyone()
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

--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

CREATE TRIGGER trigger_on_new_message_for_everyone_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@everyone%')
EXECUTE FUNCTION create_notifications_for_everyone();

-- Function to handle regular message notifications
-- Description: Creates a notification for each member of the channel, excluding the sender,
--              only if the channel is not muted, the member has not muted notifications,
--              and the member is not currently online.
--              If the user is online, they do not need a notification for the current and other channels;
--              instead, they only need the unread count and mention notifications.
CREATE OR REPLACE FUNCTION create_notifications_for_regular_messages()
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

-- Trigger remains the same
CREATE TRIGGER trigger_on_new_message_for_regular_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content NOT LIKE '%@%' OR NEW.content NOT LIKE '%@everyone%')
EXECUTE FUNCTION create_notifications_for_regular_messages();

--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

CREATE OR REPLACE FUNCTION create_notifications_for_new_unique_reactions()
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

-- Trigger remains the same
CREATE TRIGGER trigger_on_reaction_update_for_notifications
AFTER UPDATE OF reactions ON public.messages
FOR EACH ROW
WHEN (OLD.reactions IS DISTINCT FROM NEW.reactions)
EXECUTE FUNCTION create_notifications_for_new_unique_reactions();


/*
    --------------------------------------------------------
    Function: increment_unread_count_on_new_message
    Description: Increments the unread message count for each channel member when a new message is posted.
                 The count is incremented only for members who have not read messages up to the time of the new message.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
BEGIN
    -- Increment unread message count for all channel members who have not read up to this new message
    UPDATE public.channel_members
    SET unread_message_count = unread_message_count + 1
    WHERE channel_id = NEW.channel_id
      AND member_id != NEW.user_id
      AND last_read_update_at < NEW.created_at;

    RETURN NEW; -- Return the new message record
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_unread_count_on_new_message() IS 'Function to increment unread message count for channel members upon the insertion of a new message, optimized to perform a single update for all eligible members.';

/*
    --------------------------------------------------------
    Trigger: increment_unread_count_after_new_message
    Description: Triggered after a new message is inserted. Calls the
                 increment_unread_count_on_new_message function to update unread message counts
                 for members in the message's channel.
    --------------------------------------------------------
*/

CREATE TRIGGER increment_unread_count_after_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count_on_new_message();

COMMENT ON TRIGGER increment_unread_count_after_new_message ON public.messages IS 'Trigger to increment unread message count for channel members in the channel_members table after a new message is posted.';


CREATE OR REPLACE FUNCTION decrement_unread_message_count() RETURNS TRIGGER AS $$
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


CREATE TRIGGER decrement_unread_message_count_trigger_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION decrement_unread_message_count();

CREATE TRIGGER decrement_unread_message_count_trigger_hard_delete
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION decrement_unread_message_count();

--- in decrement unread message count, I have to listen to update channel_member table
--- in order if the
