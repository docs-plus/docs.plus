-- Issue #415. Pairs with scripts/10-func-notifications.sql.
-- Both fan-outs stay security definer. No trigger is recreated.

-- A picked mention node names its user by data-id, so a rename keeps it (#415). A typed token
-- is @ plus the longest run of [A-Za-z0-9_-], at the start or after a character outside that set.
-- It names the exact username holder, unless it equals a node's data-label in the same message.
-- A junk or 'everyone' id drops out. The @everyone WHEN clauses keep their own copy of the regex.
create or replace function internal.mentioned_user_ids(p_content text, p_html text)
returns setof uuid
language sql
stable
set search_path = ''
as $$
    with nodes as (
        select substring(tag[1] from '\sdata-id="([^"]*)"') as id,
               substring(tag[1] from '\sdata-label="([^"]*)"') as label
          from regexp_matches(coalesce(p_html, ''), '<span\s[^>]*>', 'g') as tag
         where tag[1] ~ '\sdata-type="mention"'
    )
    select n.id::uuid
      from nodes n
     where n.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    union
    select u.id
      from regexp_matches(coalesce(p_content, ''), '(?:^|[^A-Za-z0-9_-])@([A-Za-z0-9_-]+)', 'g') as token
      join public.users u on u.username = token[1]
     where token[1] <> 'everyone'
       and not exists (select 1 from nodes n where n.label = token[1]);
$$;

revoke all on function internal.mentioned_user_ids(text, text) from public, anon, authenticated;

-- Fans out one notification per mentioned channel member.
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

    -- 4) One row per mentioned member who has not muted.
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
        m.id,
        NEW.user_id,
        'mention',
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    FROM internal.mentioned_user_ids(NEW.content, NEW.html) AS m(id)
    JOIN public.channel_members cm ON cm.member_id = m.id AND cm.channel_id = NEW.channel_id
    WHERE m.id <> NEW.user_id
      AND cm.mute_in_app_notifications = false
      AND cm.notif_state <> 'MUTED';

    RETURN NEW;
END;
$$;

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

    -- 5) Create notifications only for members whose notif_state = 'ALL' and who are not online or the sender
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
