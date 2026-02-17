-- =============================================================================
-- Fix Push Debugging: archive processed messages, enhance stats, bypass RLS
-- =============================================================================

-- 1. Switch ack_push_message from pgmq.delete to pgmq.archive
--    This preserves processed messages in pgmq.a_push_notifications for stats.
DROP FUNCTION IF EXISTS public.ack_push_message(bigint);

CREATE FUNCTION public.ack_push_message(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pgmq.archive('push_notifications', p_msg_id);
$$;

COMMENT ON FUNCTION public.ack_push_message(bigint) IS
'Acknowledges a push notification message was processed successfully.
Archives the message (moves to pgmq.a_push_notifications) for stats tracking.';

GRANT EXECUTE ON FUNCTION public.ack_push_message(bigint) TO service_role;

-- 2. Enhance get_push_queue_stats with messages_processed & last_push_sent
DROP FUNCTION IF EXISTS public.get_push_queue_stats();

CREATE FUNCTION public.get_push_queue_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH queue_stats AS (
        SELECT
            count(*) AS queue_length,
            extract(epoch FROM (now() - min(enqueued_at))) AS oldest_msg_age_sec
        FROM pgmq.q_push_notifications
    ),
    archive_stats AS (
        SELECT
            count(*) AS messages_processed,
            max(archived_at) AS last_archived_at
        FROM pgmq.a_push_notifications
    ),
    subscription_stats AS (
        SELECT
            count(*) FILTER (WHERE is_active) AS active_subscriptions,
            count(*) FILTER (WHERE NOT is_active) AS inactive_subscriptions,
            count(*) FILTER (WHERE failed_count > 0) AS failed_subscriptions,
            max(last_used_at) AS last_push_sent
        FROM public.push_subscriptions
    )
    SELECT jsonb_build_object(
        'queue_length', coalesce(q.queue_length, 0),
        'oldest_message_age_seconds', coalesce(q.oldest_msg_age_sec, 0),
        'active_subscriptions', coalesce(s.active_subscriptions, 0),
        'inactive_subscriptions', coalesce(s.inactive_subscriptions, 0),
        'failed_subscriptions', coalesce(s.failed_subscriptions, 0),
        'messages_processed', coalesce(a.messages_processed, 0),
        'last_push_sent', coalesce(s.last_push_sent, a.last_archived_at),
        'consumer_status', CASE
            WHEN coalesce(q.queue_length, 0) = 0 THEN 'idle'
            WHEN coalesce(q.queue_length, 0) < 100 THEN 'healthy'
            WHEN coalesce(q.queue_length, 0) < 1000 THEN 'backlog'
            ELSE 'critical'
        END
    )
    FROM queue_stats q, archive_stats a, subscription_stats s;
$$;

COMMENT ON FUNCTION public.get_push_queue_stats() IS
'Returns push notification system health including queue status, archive stats, and subscription stats.';

GRANT EXECUTE ON FUNCTION public.get_push_queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_queue_stats() TO service_role;

-- 3. Admin RPC: Get recent push activity (bypasses RLS on push_subscriptions)
CREATE OR REPLACE FUNCTION public.admin_get_recent_push_activity(p_limit int DEFAULT 10)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    username text,
    device_name text,
    platform text,
    is_active boolean,
    failed_count int,
    last_error text,
    last_used_at timestamptz,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: User is not an admin.';
    END IF;

    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        u.username,
        ps.device_name,
        ps.platform,
        ps.is_active,
        ps.failed_count,
        ps.last_error,
        ps.last_used_at,
        ps.created_at
    FROM public.push_subscriptions ps
    JOIN public.users u ON ps.user_id = u.id
    WHERE ps.is_active = true
    ORDER BY ps.last_used_at DESC NULLS LAST
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_recent_push_activity(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_recent_push_activity(int) FROM anon;

-- 4. Admin RPC: Get failed push subscriptions (bypasses RLS on push_subscriptions)
CREATE OR REPLACE FUNCTION public.admin_get_failed_push_subs(p_limit int DEFAULT 10)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    username text,
    device_name text,
    platform text,
    is_active boolean,
    failed_count int,
    last_error text,
    last_used_at timestamptz,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: User is not an admin.';
    END IF;

    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        u.username,
        ps.device_name,
        ps.platform,
        ps.is_active,
        ps.failed_count,
        ps.last_error,
        ps.last_used_at,
        ps.created_at
    FROM public.push_subscriptions ps
    JOIN public.users u ON ps.user_id = u.id
    WHERE ps.failed_count > 0
    ORDER BY ps.failed_count DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_failed_push_subs(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_failed_push_subs(int) FROM anon;

