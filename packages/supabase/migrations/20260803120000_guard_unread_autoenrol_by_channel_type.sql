-- Guards the unread auto-enrolment by channel type.
--
-- increment_unread_count_on_new_message() enrols every workspace member into
-- channel_members so unread badges cover headings nobody explicitly joined. That
-- enrolment had no type check, and internal.can_read_channel() grants read on an
-- active channel_members row - so the first message in a non-PUBLIC channel would
-- publish it to the whole workspace. Latent only because no non-PUBLIC channel
-- exists yet; ChannelComposer already branches on DIRECT/BROADCAST/ARCHIVE/GROUP,
-- so the guard has to land before any of them is created.
--
-- Auto-enrolment is now PUBLIC-only. The increment UPDATE is unchanged: it only
-- touches rows that already exist, which is correct for every channel type.
--
-- CREATE OR REPLACE resets a function to INVOKER, so both ALTERs below are
-- required - without them the enrolment INSERT hits RLS on channel_members and
-- unread badges silently stop updating for non-members.

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

ALTER FUNCTION public.increment_unread_count_on_new_message() SET search_path = public;
ALTER FUNCTION public.increment_unread_count_on_new_message() SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_unread_count_on_new_message() IS 'Increments unread message count for workspace members on a new message. Auto-enrols non-members on PUBLIC channels only - a channel_members row grants read access, so enrolling on any other type would expose the channel.';
