-- Fan-out triggers for message-driven notifications (mentions, @everyone,
-- replies, reactions, regular sends) and unread-count maintenance.

-- Fans out one notification per channel member mentioned by @username.
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

    -- 4) For each mentioned username, attempt to create a notification.
    --    Anchored regex prevents `@al` from matching `alice`/`alpha`.
    --    Usernames are validated as `^[a-z][a-z0-9_-]{2,29}$` at the
    --    table level, so concatenating into the pattern is safe.
    FOR mentioned_user_id IN
        SELECT u.id
          FROM public.users u
         WHERE NEW.content ~ ('(^|[^a-z0-9_-])@' || u.username || '($|[^a-z0-9_-])')
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
$$;

COMMENT ON FUNCTION create_mention_notifications() IS 'Creates notifications for users who are mentioned with @username in a message.';

-- Trigger: create_mention_notifications
CREATE TRIGGER create_mention_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@%')
EXECUTE FUNCTION create_mention_notifications();

COMMENT ON TRIGGER create_mention_notifications ON public.messages IS 'Creates notifications for users mentioned with @username in a message.';

-- Replies are high-signal: always notify the original author unless the
-- channel is muted, regardless of notif_state.
CREATE OR REPLACE FUNCTION create_reply_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    original_message RECORD;
    truncated_content TEXT;
BEGIN
    -- Only process if this is a reply
    IF NEW.reply_to_message_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the original message and channel info
    SELECT m.user_id, m.channel_id, c.mute_in_app_notifications
    INTO original_message
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.id = NEW.reply_to_message_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Skip if channel is globally muted
    IF original_message.mute_in_app_notifications THEN
        RETURN NEW;
    END IF;

    -- Skip if replying to own message
    IF original_message.user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Skip if user has muted this channel
    IF EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_id = NEW.channel_id
          AND member_id = original_message.user_id
          AND mute_in_app_notifications = TRUE
    ) THEN
        RETURN NEW;
    END IF;

    -- Truncate content for preview
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

    -- Create the reply notification
    INSERT INTO public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    ) VALUES (
        original_message.user_id,
        NEW.user_id,
        'reply'::notification_category,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION create_reply_notification() IS
'Creates notification for original message author when someone replies. Always notifies regardless of notif_state.';

-- Trigger: create_reply_notification
DROP TRIGGER IF EXISTS create_reply_notification ON public.messages;
CREATE TRIGGER create_reply_notification
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.reply_to_message_id IS NOT NULL)
EXECUTE FUNCTION create_reply_notification();

COMMENT ON TRIGGER create_reply_notification ON public.messages IS
'Notifies the original message author when someone replies to their message.';

-- Fans out @everyone to every non-sender channel member that hasn't muted.
CREATE OR REPLACE FUNCTION create_everyone_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

    -- 4) Check for an actual @everyone token (not a substring inside
    --    something like `@everyone_team`).
    IF NEW.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])' THEN
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
$$;

COMMENT ON FUNCTION create_everyone_notifications() IS 'Creates notifications for all channel members when @everyone is used in a message.';

-- Trigger: create_everyone_notifications
-- Tokenised match — must mirror the IF inside the function body.
DROP TRIGGER IF EXISTS create_everyone_notifications ON public.messages;
CREATE TRIGGER create_everyone_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])')
EXECUTE FUNCTION create_everyone_notifications();

COMMENT ON TRIGGER create_everyone_notifications ON public.messages IS 'Creates notifications for all channel members when @everyone is used.';

-- Notifies offline, ALL-state, non-muted channel members for plain (no
-- mention / no @everyone) messages. Trigger predicate filters the rest.
CREATE OR REPLACE FUNCTION create_regular_message_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

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
    -- Reply notifications for the original-message author are emitted by
    -- create_reply_notification; do not duplicate the row here.
    SELECT
        cm.member_id,
        NEW.user_id,
        'message'::notification_category,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.member_id
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id  != NEW.user_id
      AND (u.status IS NULL OR u.status != 'ONLINE')
      AND cm.mute_in_app_notifications = FALSE
      AND cm.notif_state = 'ALL';

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION create_regular_message_notifications() IS 'Creates notifications for regular messages based on user notification preferences.';

-- Trigger: create_regular_message_notifications
-- Fire only on messages that contain NO @user mention and NO @everyone.
-- Original predicate `(... NOT LIKE '%@%' OR ... NOT LIKE '%@everyone%')`
-- is true for nearly every string containing '@' (any @user that isn't
-- exactly @everyone) and produced duplicate inbox rows alongside the
-- mention/reply/everyone notification creators. Use a regex that matches
-- either pattern and negate with `!~`.
CREATE TRIGGER create_regular_message_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content !~ '@[A-Za-z0-9_]+|@everyone')
EXECUTE FUNCTION create_regular_message_notifications();

COMMENT ON TRIGGER create_regular_message_notifications ON public.messages IS 'Creates notifications for regular messages that contain no @mention and no @everyone.';

-- Reactions are high-signal: always notify the message owner per new
-- reaction entry, regardless of notif_state. Channel mute still applies.
CREATE OR REPLACE FUNCTION create_reaction_notifications()
RETURNS TRIGGER AS $$
DECLARE
    old_reactions     JSONB;
    new_reactions     JSONB;
    reaction_key      TEXT;
    new_reaction      JSONB;
    sender_user_id    UUID;
    is_channel_muted  BOOLEAN;
    is_user_muted     BOOLEAN;
BEGIN
    -- 1) Check if the channel is globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW;
    END IF;

    -- 2) Verify the message owner exists
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = OLD.user_id
    ) THEN
        RETURN NEW;
    END IF;

    -- 3) Check if user has muted this channel (ignore notif_state for reactions)
    SELECT cm.mute_in_app_notifications
      INTO is_user_muted
      FROM public.channel_members cm
     WHERE cm.channel_id = NEW.channel_id
       AND cm.member_id = OLD.user_id;

    IF is_user_muted THEN
        RETURN NEW;
    END IF;

    -- 4) Compare old and new reactions
    old_reactions := COALESCE(OLD.reactions, '{}'::jsonb);
    new_reactions := NEW.reactions;

    -- 5) Loop through each reaction type
    FOR reaction_key IN
        SELECT jsonb_object_keys(new_reactions)
    LOOP
        FOR new_reaction IN
            SELECT jsonb_array_elements(new_reactions -> reaction_key)
        LOOP
            sender_user_id := (new_reaction ->> 'user_id')::UUID;

            -- Skip if reacting to own message
            IF sender_user_id = OLD.user_id THEN
                CONTINUE;
            END IF;

            -- Skip if reaction already existed
            IF (old_reactions ? reaction_key)
               AND (old_reactions -> reaction_key) @> jsonb_build_array(new_reaction)
            THEN
                CONTINUE;
            END IF;

            -- Verify sender exists and create notification
            IF EXISTS (SELECT 1 FROM public.users WHERE id = sender_user_id) THEN
                INSERT INTO public.notifications (
                    receiver_user_id,
                    sender_user_id,
                    type,
                    message_id,
                    channel_id,
                    message_preview,
                    created_at
                ) VALUES (
                    OLD.user_id,
                    sender_user_id,
                    'reaction'::notification_category,
                    NEW.id,
                    NEW.channel_id,
                    reaction_key,  -- Store the emoji
                    timezone('utc', now())
                );
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_reaction_notifications() IS
'Creates notification when someone reacts to your message. Always notifies regardless of notif_state.';

-- Trigger: create_reaction_notifications
CREATE TRIGGER create_reaction_notifications
AFTER UPDATE OF reactions ON public.messages
FOR EACH ROW
WHEN (OLD.reactions IS DISTINCT FROM NEW.reactions)
EXECUTE FUNCTION create_reaction_notifications();

COMMENT ON TRIGGER create_reaction_notifications ON public.messages IS 'Creates notifications when a message receives new reactions.';

-- Bumps unread_message_count for every workspace member (creating their
-- channel_members row if missing) except the sender, so unread badges
-- include people who never explicitly joined the channel.
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

    -- First, ensure all workspace members have a channel_members entry.
    -- Seed unread at 0, not 1: the increment UPDATE below always re-matches
    -- this fresh row (its last_read_update_at is < NEW.created_at) and brings
    -- it to 1 in the same transaction, so seeding 1 double-counts to 2.
    INSERT INTO public.channel_members (channel_id, member_id, unread_message_count, last_read_update_at)
    SELECT
        NEW.channel_id,
        wm.member_id,
        0,
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
 * DEPRECATED: update_unread_count_on_message_delete
 *
 * This function and its triggers have been removed.
 * Unread count decrements are now handled in handle_message_soft_delete()
 * in 10-3-func-message.sql, which decrements counts BEFORE deleting
 * notifications to ensure we know exactly which users to update.
 *
 * See: handle_message_soft_delete() in 10-3-func-message.sql
 */

-- Drop the old triggers (if they exist)
DROP TRIGGER IF EXISTS update_unread_count_on_soft_delete ON public.messages;
DROP TRIGGER IF EXISTS update_unread_count_on_hard_delete ON public.messages;

-- Drop the old function (if it exists)
DROP FUNCTION IF EXISTS update_unread_count_on_message_delete();

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.create_mention_notifications() SET search_path = public;
ALTER FUNCTION public.create_reply_notification() SET search_path = public;
ALTER FUNCTION public.create_everyone_notifications() SET search_path = public;
ALTER FUNCTION public.create_regular_message_notifications() SET search_path = public;
ALTER FUNCTION public.create_reaction_notifications() SET search_path = public;
ALTER FUNCTION public.increment_unread_count_on_new_message() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.create_mention_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_reply_notification() SECURITY DEFINER;
ALTER FUNCTION public.create_everyone_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_regular_message_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_reaction_notifications() SECURITY DEFINER;
ALTER FUNCTION public.increment_unread_count_on_new_message() SECURITY DEFINER;
