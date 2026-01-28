-- -----------------------------------------------------------------------------
-- Notification Broadcast Trigger
-- -----------------------------------------------------------------------------
-- Description: Broadcasts notification changes to user-specific topics for
-- efficient realtime updates with workspace context.
--
-- Architecture Choice: User-Specific Broadcast (Option C)
--
-- Why this approach:
--   1. O(1) routing per event - no server-side filtering overhead
--   2. Events go ONLY to the intended user's topic
--   3. Includes workspace_id so client can filter by workspace if needed
--   4. More efficient than postgres_changes at scale
--
-- Trade-off: Uses separate channel from workspace channel, but this is
-- the most efficient approach for user-specific notifications.
--
-- Reference: https://supabase.com/blog/realtime-broadcast-from-database
-- -----------------------------------------------------------------------------

-- Trigger function to broadcast notification changes to user-specific topics
CREATE OR REPLACE FUNCTION public.broadcast_notification_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  topic TEXT;
  user_id UUID;
  workspace_id_val VARCHAR(36);
  payload JSONB;
BEGIN
  -- Determine the user ID based on the operation
  IF TG_OP = 'DELETE' THEN
    user_id := OLD.receiver_user_id;
  ELSE
    user_id := NEW.receiver_user_id;
  END IF;

  -- Get workspace_id from the channel (for workspace context)
  IF TG_OP = 'DELETE' THEN
    SELECT c.workspace_id INTO workspace_id_val
    FROM public.channels c
    WHERE c.id = OLD.channel_id;
  ELSE
    SELECT c.workspace_id INTO workspace_id_val
    FROM public.channels c
    WHERE c.id = NEW.channel_id;
  END IF;

  -- Build the topic for this user's notifications
  topic := 'notifications:' || user_id::TEXT;

  -- Build payload with workspace context
  payload := jsonb_build_object(
    'event', TG_OP,
    'workspace_id', workspace_id_val,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  -- Use realtime.send for direct broadcast to the topic
  PERFORM realtime.send(
    payload,
    TG_OP,      -- event name: INSERT, UPDATE, DELETE
    topic,      -- topic: notifications:{user_id}
    FALSE       -- private: false (public channel, but user-specific topic)
  );

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.broadcast_notification_changes() IS
'Broadcasts notification changes to user-specific topics with workspace context.
Benefits:
- O(1) routing per event (no server-side filtering)
- Includes workspace_id for client-side filtering if needed
- Direct delivery to intended recipient only';

-- Create the trigger on notifications table
DROP TRIGGER IF EXISTS broadcast_notification_changes_trigger ON public.notifications;

CREATE TRIGGER broadcast_notification_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_notification_changes();

COMMENT ON TRIGGER broadcast_notification_changes_trigger ON public.notifications IS
'Triggers broadcast of notification changes to the receiver user topic with workspace context.';
