-- Migration: admin_get_user_notification_subs
-- Purpose:   Allow admin dashboard to read ALL users' push subscriptions
--            despite RLS on push_subscriptions (policy: auth.uid() = user_id).
--
-- The function uses SECURITY DEFINER to bypass RLS and is guarded by
-- is_admin(auth.uid()) so only admin users can invoke it.

CREATE OR REPLACE FUNCTION public.admin_get_user_notification_subs()
RETURNS TABLE (
  user_id uuid,
  platforms text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ps.user_id,
    array_agg(DISTINCT ps.platform) AS platforms
  FROM push_subscriptions ps
  WHERE ps.is_active = true
    AND is_admin(auth.uid())
  GROUP BY ps.user_id;
$$;

-- Only authenticated users (not anon) may call this
REVOKE EXECUTE ON FUNCTION public.admin_get_user_notification_subs() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_notification_subs() TO authenticated;

