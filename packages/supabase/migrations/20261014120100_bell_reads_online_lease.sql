-- Issue #490. The plain-message bell uses the online lease internal.is_user_online, as push does.
-- Before, it read the raw users.status flag. Pairs with scripts/10-func-notifications.sql.
-- CREATE OR REPLACE keeps the ACL. The body calls internal.mentioned_user_ids from 20261009120300.

-- Notifies offline, ALL-state, non-muted channel members for messages with no
-- @everyone and no mention of another channel member.
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

    -- 3) A mention of another member makes this a mention message.
    --    Membership alone decides it: a muted member still counts.
    IF EXISTS (
        SELECT 1
          FROM internal.mentioned_user_ids(NEW.content, NEW.html) AS m(id)
          JOIN public.channel_members cm ON cm.member_id = m.id AND cm.channel_id = NEW.channel_id
         WHERE m.id <> NEW.user_id
    ) THEN
        RETURN NEW;
    END IF;

    -- 4) Truncate message content for preview
    truncated_content := message_content_preview(NEW.content, NEW.medias, NEW.type);

    -- 5) Notify ALL-state members who are not the sender and not online.
    --    Online is the lease in internal.is_user_online, the rule push uses too.
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
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id  != NEW.user_id
      AND NOT internal.is_user_online(cm.member_id)
      AND cm.mute_in_app_notifications = FALSE
      AND cm.notif_state = 'ALL';

    RETURN NEW;
END;
$$;
