-- Seed a freshly auto-enrolled member's unread at 0, not 1: the same-transaction
-- increment UPDATE below always re-matches the fresh row and brings it to 1, so
-- seeding 1 double-counts the first unread to 2. Mirrors
-- packages/supabase/scripts/10-func-notifications.sql.
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

-- CREATE OR REPLACE resets SECURITY/search_path to command defaults; re-assert.
ALTER FUNCTION public.increment_unread_count_on_new_message() SET search_path = public;
ALTER FUNCTION public.increment_unread_count_on_new_message() SECURITY DEFINER;
