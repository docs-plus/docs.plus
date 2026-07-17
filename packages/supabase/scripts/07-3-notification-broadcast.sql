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
SET search_path = public
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

  -- Private broadcast: subscribers are authorized via the
  -- `notifications_topic_access` policy on realtime.messages below.
  -- Without `private := TRUE`, anyone who learns a user UUID (logs,
  -- attribution headers, public profile, invite links) can subscribe
  -- to `notifications:<uid>` and receive that user's notifications.
  PERFORM realtime.send(
    payload,
    TG_OP,      -- event name: INSERT, UPDATE, DELETE
    topic,      -- topic: notifications:{user_id}
    TRUE        -- private: true (auth-gated by RLS on realtime.messages)
  );

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.broadcast_notification_changes() IS
'Broadcasts notification changes to private user-specific topics with workspace context.
Benefits:
- O(1) routing per event (no server-side filtering)
- Includes workspace_id for client-side filtering if needed
- Direct delivery to intended recipient only
- Subscribers authorized by realtime.messages RLS (notifications_topic_access).';

-- Create the trigger on notifications table
DROP TRIGGER IF EXISTS broadcast_notification_changes_trigger ON public.notifications;

CREATE TRIGGER broadcast_notification_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_notification_changes();

COMMENT ON TRIGGER broadcast_notification_changes_trigger ON public.notifications IS
'Triggers broadcast of notification changes to the receiver user topic with workspace context.';

-- -----------------------------------------------------------------------------
-- Authorization for private notification topic subscriptions
-- -----------------------------------------------------------------------------
-- When `realtime.send(..., private := TRUE)` writes to a topic, Supabase
-- Realtime gates subscriptions through RLS on `realtime.messages`. Without
-- a policy, all private subscriptions for `notifications:*` are denied.
--
-- Rule: an authenticated user may subscribe ONLY to their own per-user
-- topic, i.e. `notifications:<auth.uid()>`. No cross-user leakage.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_topic_access" ON realtime.messages;

CREATE POLICY "notifications_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.topic = 'notifications:' || (select auth.uid())::text
);

COMMENT ON POLICY "notifications_topic_access" ON realtime.messages IS
'Allows authenticated users to subscribe to their own per-user notification topic
(notifications:<auth.uid()>). Pairs with broadcast_notification_changes() which
sends with private := TRUE.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.broadcast_notification_changes() SET search_path = public;
