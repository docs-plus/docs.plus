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

-- Bumps unread_message_count for every workspace member except the sender, so
-- unread badges include people who never explicitly joined. On PUBLIC channels it
-- also creates the missing channel_members row; on every other type it must not,
-- because that row is what grants read access.
CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    workspace_id_var VARCHAR(36);
    channel_type_var public.channel_type;
BEGIN
    -- Skip if message type is notification
    IF NEW.type = 'notification' THEN
        RETURN NEW;
    END IF;

    -- Get the workspace ID and type for the channel where the message was posted
    SELECT workspace_id, type INTO workspace_id_var, channel_type_var
    FROM public.channels
    WHERE id = NEW.channel_id;

    -- If channel doesn't exist or has no workspace, exit early
    IF workspace_id_var IS NULL THEN
        RETURN NEW;
    END IF;

    -- Auto-enrolment is PUBLIC-only, because internal.can_read_channel grants read
    -- on an active channel_members row: enrolling the workspace into a DIRECT or
    -- GROUP channel would publish it to everyone. PUBLIC already reads via its type,
    -- so the row it creates grants nothing and only carries the unread badge.
    IF channel_type_var = 'PUBLIC' THEN
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
    END IF;

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

COMMENT ON FUNCTION increment_unread_count_on_new_message() IS 'Increments unread message count for workspace members on a new message. Auto-enrols non-members on PUBLIC channels only — a channel_members row grants read access, so enrolling on any other type would expose the channel.';

-- Trigger: increment_unread_count
CREATE TRIGGER increment_unread_count
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count_on_new_message();

COMMENT ON TRIGGER increment_unread_count ON public.messages IS 'Increments the unread message count for workspace members when a new message is posted; auto-enrols only on PUBLIC channels.';

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


-- Service-role fan-out for document content changes. It writes one
-- content_change carrier per follower into public.notifications. The digest
-- computes the real diff at send time, so extra carriers add no information.
create or replace function public.notify_document_content_change(
    p_document_id varchar(36),
    p_editor_ids uuid[] default '{}',
    p_only_user uuid default null,
    p_actor_id uuid default null,
    p_action_url text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    -- A null inside the array makes `= any(...)` yield null, which rejects every
    -- candidate and fans out to nobody. Every REST write path sends [null].
    v_editor_ids uuid[] := array_remove(coalesce(p_editor_ids, '{}'::uuid[]), null::uuid);
    v_sender_user_id uuid;
    v_count integer := 0;
begin
    -- Ruled: a document no signed-in person has ever opened has no workspaces
    -- row, notifies nobody, and this read path must not create that row.
    if not exists (
        select 1
          from public.workspaces
         where id = p_document_id
           and deleted_at is null
    ) then
        return 0;
    end if;

    -- Same rule as the workspace guard above: this read path creates nothing.
    -- A workspaces row implies a channels row, because join_workspace is the
    -- only writer of workspaces and always follows it with a member insert,
    -- whose trigger mints the channel. A null here means a broken document.
    if not exists (select 1 from public.channels where id = p_document_id) then
        return 0;
    end if;

    -- Insert a null sender, do not skip the row and do not abort the call.
    -- A REST write has no acting person, and the FK would fail the insert.
    v_sender_user_id := (select u.id from public.users u where u.id = p_actor_id);

    with recipients as (
        select wm.member_id as receiver_user_id
          from public.workspace_members wm
         where p_only_user is null
           and wm.workspace_id = p_document_id
           and wm.left_at is null
           and wm.content_email_muted_at is null
        union all
        -- Membership is not required on this branch. An owner who opened the
        -- document but never joined the workspace must still be reached. A
        -- member who muted it, or who left it, is not: both arms read the mute
        -- column the same way, and it only means anything while left_at is null.
        select p_only_user
         where p_only_user is not null
           and exists (select 1 from public.users where id = p_only_user)
           and not exists (
               select 1
                 from public.workspace_members wm
                where wm.workspace_id = p_document_id
                  and wm.member_id = p_only_user
                  and (wm.content_email_muted_at is not null or wm.left_at is not null)
           )
    )
    insert into public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        action_url,
        created_at
    )
    -- The window keys on an unread carrier, so reading one re-arms it and the
    -- same person can be told again inside the same day.
    select
        r.receiver_user_id,
        v_sender_user_id,
        'content_change'::notification_category,
        null::uuid,
        p_document_id,
        'Document content updated',
        p_action_url,
        timezone('utc', now())
      from recipients r
     -- One home for the self-suppression rule, rather than one copy per arm.
     where not (r.receiver_user_id = any (v_editor_ids))
       and not exists (
         select 1
           from public.notifications n
          where n.receiver_user_id = r.receiver_user_id
            and n.type = 'content_change'
            and n.channel_id = p_document_id
            and n.readed_at is null
            and n.created_at > now() - interval '24 hours'
     );

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

comment on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text) is
'Service-role only fan-out of document content changes. Inserts one content_change notification per eligible follower and returns the row count. Editors, members who muted the document, and anyone already holding an unread carrier from the last 24 hours are skipped. Writes nothing but notifications: it returns 0 when the document has no workspaces row or no channels row.';

-- Server-side only: the hocuspocus worker fans out with the service_role key.
-- The webapp must never call it, so the browser roles stay revoked here too.
-- §5 of 29-lint-hardening revokes from public, anon and authenticated only,
-- so the service_role grant below survives that sweep.
revoke execute on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text)
    from public, anon, authenticated;
grant execute on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text)
    to service_role;
