-- =============================================================================
-- Phase 17: Failed Notifications Audit — Admin Functions
-- =============================================================================
--
-- Creates 6 functions for auditing notification delivery failures.
-- All functions live in the public schema (Supabase PostgREST convention)
-- and use SECURITY DEFINER + search_path = public for safe RLS bypass.
-- Access control is enforced at the API layer via adminAuthMiddleware.
--
-- Prerequisites:
--   - public.push_subscriptions (script 19)
--   - public.email_queue (script 20)
--   - public.email_bounces (script 20)
--   - public.users
--
-- Column reference verification:
--   push_subscriptions: failed_count, last_error, is_active, updated_at, push_credentials (jsonb)
--   email_queue: status, error_message (NOT 'error'), created_at (NO 'updated_at'), attempts
--   email_bounces: bounce_type, provider, reason, email, created_at

-- =============================================================================
-- 1. Push Failure Summary (error category + platform breakdown)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_push_failure_summary()
RETURNS TABLE (
  error_category TEXT,
  platform TEXT,
  failure_count BIGINT,
  affected_users BIGINT,
  last_failure_at TIMESTAMPTZ,
  sample_errors TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN ps.last_error ILIKE '%410%' OR ps.last_error ILIKE '%expired%' THEN 'EXPIRED'
      WHEN ps.last_error ILIKE '%404%' OR ps.last_error ILIKE '%not found%' THEN 'NOT_FOUND'
      WHEN ps.last_error ILIKE '%401%' OR ps.last_error ILIKE '%unauthorized%' THEN 'UNAUTHORIZED'
      WHEN ps.last_error ILIKE '%429%' OR ps.last_error ILIKE '%rate%' THEN 'RATE_LIMITED'
      WHEN ps.last_error ILIKE '%413%' OR ps.last_error ILIKE '%payload%' THEN 'PAYLOAD_TOO_LARGE'
      WHEN ps.last_error ILIKE '%timeout%' THEN 'TIMEOUT'
      WHEN ps.last_error ILIKE '%network%' OR ps.last_error ILIKE '%connect%' THEN 'NETWORK_ERROR'
      ELSE 'OTHER'
    END AS error_category,

    CASE
      WHEN ps.push_credentials->>'endpoint' ILIKE '%fcm.googleapis.com%' THEN 'android'
      WHEN ps.push_credentials->>'endpoint' ILIKE '%web.push.apple.com%' THEN 'ios'
      WHEN ps.platform IS NOT NULL THEN ps.platform
      ELSE 'web'
    END AS platform,

    COUNT(*) AS failure_count,
    COUNT(DISTINCT ps.user_id) AS affected_users,
    MAX(ps.updated_at) AS last_failure_at,
    (array_agg(DISTINCT ps.last_error ORDER BY ps.last_error) FILTER (WHERE ps.last_error IS NOT NULL))[1:3] AS sample_errors

  FROM public.push_subscriptions ps
  WHERE ps.failed_count > 0
    AND ps.last_error IS NOT NULL
  GROUP BY 1, 2
  ORDER BY failure_count DESC;
$$;

-- =============================================================================
-- 2. Email Failure Summary (from email_queue + email_bounces)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_failure_summary()
RETURNS TABLE (
  source TEXT,
  error_category TEXT,
  failure_count BIGINT,
  affected_users BIGINT,
  last_failure_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Failed emails from email_queue (uses error_message, NOT error)
  SELECT
    'queue' AS source,
    CASE
      WHEN eq.error_message ILIKE '%bounce%hard%' OR eq.error_message ILIKE '%invalid%email%' THEN 'HARD_BOUNCE'
      WHEN eq.error_message ILIKE '%bounce%soft%' OR eq.error_message ILIKE '%mailbox%full%' THEN 'SOFT_BOUNCE'
      WHEN eq.error_message ILIKE '%spam%' OR eq.error_message ILIKE '%complaint%' THEN 'SPAM_COMPLAINT'
      WHEN eq.error_message ILIKE '%rate%' OR eq.error_message ILIKE '%limit%' THEN 'RATE_LIMITED'
      WHEN eq.error_message ILIKE '%timeout%' THEN 'TIMEOUT'
      WHEN eq.error_message ILIKE '%Permanent failure%' THEN 'PERMANENT_FAILURE'
      ELSE 'OTHER'
    END AS error_category,
    COUNT(*) AS failure_count,
    COUNT(DISTINCT eq.user_id) AS affected_users,
    MAX(eq.created_at) AS last_failure_at  -- email_queue has NO updated_at column
  FROM public.email_queue eq
  WHERE eq.status = 'failed'
  GROUP BY 1, 2

  UNION ALL

  -- Bounces from email_bounces table (the authoritative bounce source)
  SELECT
    'bounce' AS source,
    UPPER(eb.bounce_type) AS error_category,
    COUNT(*) AS failure_count,
    COUNT(DISTINCT u.id) AS affected_users,
    MAX(eb.created_at) AS last_failure_at
  FROM public.email_bounces eb
  LEFT JOIN public.users u ON lower(u.email) = lower(eb.email)
  GROUP BY 1, 2

  ORDER BY failure_count DESC;
$$;

-- =============================================================================
-- 3. Detailed Failed Push Subscriptions (with user info)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_failed_push_subscriptions(
  p_min_failures INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  username TEXT,
  user_email TEXT,
  platform TEXT,
  error_category TEXT,
  last_error TEXT,
  failed_count INTEGER,
  is_active BOOLEAN,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    ps.id AS subscription_id,
    ps.user_id,
    u.username,
    u.email AS user_email,
    COALESCE(ps.platform,
      CASE
        WHEN ps.push_credentials->>'endpoint' ILIKE '%fcm.googleapis.com%' THEN 'android'
        WHEN ps.push_credentials->>'endpoint' ILIKE '%web.push.apple.com%' THEN 'ios'
        ELSE 'web'
      END
    ) AS platform,
    CASE
      WHEN ps.last_error ILIKE '%410%' OR ps.last_error ILIKE '%expired%' THEN 'EXPIRED'
      WHEN ps.last_error ILIKE '%404%' OR ps.last_error ILIKE '%not found%' THEN 'NOT_FOUND'
      WHEN ps.last_error ILIKE '%401%' OR ps.last_error ILIKE '%unauthorized%' THEN 'UNAUTHORIZED'
      WHEN ps.last_error ILIKE '%429%' OR ps.last_error ILIKE '%rate%' THEN 'RATE_LIMITED'
      ELSE 'OTHER'
    END AS error_category,
    ps.last_error,
    ps.failed_count,
    ps.is_active,
    ps.updated_at AS last_failure_at,
    ps.created_at
  FROM public.push_subscriptions ps
  LEFT JOIN public.users u ON u.id = ps.user_id
  WHERE ps.failed_count >= p_min_failures
  ORDER BY ps.failed_count DESC, ps.updated_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 4. Email Bounces List (admin-only, shows full email)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_bounces(
  p_bounce_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  bounce_id UUID,
  email TEXT,
  bounce_type TEXT,
  provider TEXT,
  reason TEXT,
  user_id UUID,
  username TEXT,
  bounced_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    eb.id AS bounce_id,
    eb.email,
    eb.bounce_type,
    eb.provider,
    eb.reason,
    u.id AS user_id,
    u.username,
    eb.created_at AS bounced_at
  FROM public.email_bounces eb
  LEFT JOIN public.users u ON lower(u.email) = lower(eb.email)
  WHERE (p_bounce_type IS NULL OR eb.bounce_type = p_bounce_type)
    AND eb.created_at > now() - make_interval(days => p_days)
  ORDER BY eb.created_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 5. Combined Notification Health Score
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'push', jsonb_build_object(
      'total_subscriptions', (SELECT count(*) FROM push_subscriptions),
      'active_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE is_active = true),
      'failed_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE failed_count > 0),
      'disabled_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE is_active = false),
      'expired_subscriptions', (SELECT count(*) FROM push_subscriptions
        WHERE is_active = false AND (last_error ILIKE '%410%' OR last_error ILIKE '%expired%')),
      'delivery_rate', CASE
        WHEN (SELECT count(*) FROM push_subscriptions WHERE is_active = true) > 0
        THEN round(
          (SELECT count(*) FROM push_subscriptions WHERE is_active = true AND failed_count = 0)::numeric /
          GREATEST((SELECT count(*) FROM push_subscriptions WHERE is_active = true)::numeric, 1) * 100, 1
        )
        ELSE 100
      END
    ),
    'email', jsonb_build_object(
      'total_queued', (SELECT count(*) FROM email_queue),
      'sent', (SELECT count(*) FROM email_queue WHERE status = 'sent'),
      'failed', (SELECT count(*) FROM email_queue WHERE status = 'failed'),
      'pending', (SELECT count(*) FROM email_queue WHERE status = 'pending'),
      'skipped', (SELECT count(*) FROM email_queue WHERE status = 'skipped'),
      'hard_bounces', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'hard'),
      'soft_bounces', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'soft'),
      'complaints', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'complaint'),
      'delivery_rate', CASE
        WHEN (SELECT count(*) FROM email_queue WHERE status IN ('sent', 'failed')) > 0
        THEN round(
          (SELECT count(*) FROM email_queue WHERE status = 'sent')::numeric /
          GREATEST((SELECT count(*) FROM email_queue WHERE status IN ('sent', 'failed'))::numeric, 1) * 100, 1
        )
        ELSE 100
      END
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- =============================================================================
-- 6. Bulk Disable Failed Push Subscriptions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.disable_failed_subscriptions(
  p_min_failures INTEGER DEFAULT 5,
  p_error_pattern TEXT DEFAULT '%',
  p_subscription_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  disabled_count INTEGER,
  subscription_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_ids UUID[];
BEGIN
  IF p_subscription_ids IS NOT NULL AND array_length(p_subscription_ids, 1) > 0 THEN
    -- ID-based disable: only disable the specific subscriptions provided
    SELECT array_agg(id)
    INTO v_ids
    FROM public.push_subscriptions
    WHERE id = ANY(p_subscription_ids)
      AND is_active = true;
  ELSE
    -- Pattern-based disable: use min_failures + error pattern
    SELECT array_agg(id)
    INTO v_ids
    FROM public.push_subscriptions
    WHERE failed_count >= p_min_failures
      AND is_active = true
      AND (p_error_pattern = '%' OR last_error ILIKE p_error_pattern);
  END IF;

  UPDATE public.push_subscriptions
  SET is_active = false, updated_at = now()
  WHERE id = ANY(COALESCE(v_ids, ARRAY[]::uuid[]));

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, COALESCE(v_ids, ARRAY[]::uuid[]);
END;
$$;
