import { supabase } from '@/lib/supabase'
import type { PushSubscriptionDetail } from '@/types'
import { logError } from '@/utils/logger'

// The only reads that legitimately use the browser anon-key client: an
// RLS-visible health probe and is_admin-gated SECURITY DEFINER RPCs.
// Everything else routes through fetchApi in services/api.ts.

/**
 * Probe Supabase reachability/latency. Uses a head-only request (no row count)
 * so the System page's 30s poll never triggers a full-table scan.
 */
export async function checkDatabaseHealth(): Promise<{ status: string; latency: number }> {
  const start = Date.now()
  try {
    const { error } = await supabase.from('users').select('id', { head: true }).limit(1)
    return {
      status: error ? 'degraded' : 'healthy',
      latency: Date.now() - start
    }
  } catch {
    return { status: 'down', latency: 0 }
  }
}

/** Map a raw admin RPC row to a PushSubscriptionDetail. */
function mapPushSubscriptionDetail(sub: Record<string, unknown>): PushSubscriptionDetail {
  return {
    id: sub.id as string,
    user_id: sub.user_id as string,
    username: (sub.username as string) || null,
    device_name: (sub.device_name as string) || null,
    platform: sub.platform as string,
    is_active: sub.is_active as boolean,
    failed_count: sub.failed_count as number,
    last_error: (sub.last_error as string) || null,
    last_used_at: (sub.last_used_at as string) || null,
    created_at: sub.created_at as string
  }
}

/**
 * Fetch failed push subscriptions with details (all users, bypasses RLS).
 * Uses admin_get_failed_push_subs RPC (SECURITY DEFINER, gated on is_admin).
 */
export async function fetchFailedPushSubscriptions(limit = 10): Promise<PushSubscriptionDetail[]> {
  const { data, error } = await supabase.rpc('admin_get_failed_push_subs', { p_limit: limit })

  if (error) {
    logError('Failed to fetch failed push subscriptions:', error)
    return []
  }

  return ((data as Array<Record<string, unknown>> | null) || []).map(mapPushSubscriptionDetail)
}

/**
 * Fetch recent push activity for all users (bypasses RLS).
 * Uses admin_get_recent_push_activity RPC (SECURITY DEFINER, gated on is_admin).
 */
export async function fetchRecentPushActivity(limit = 10): Promise<PushSubscriptionDetail[]> {
  const { data, error } = await supabase.rpc('admin_get_recent_push_activity', { p_limit: limit })

  if (error) {
    logError('Failed to fetch recent push activity:', error)
    return []
  }

  return ((data as Array<Record<string, unknown>> | null) || []).map(mapPushSubscriptionDetail)
}
