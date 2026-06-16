/**
 * Admin Notification-Failures Service — bulk-disable logic for failed push
 * subscriptions. Read-only notification metrics stay inline as thin RPC wrappers
 * in the controller; only the result-shaping disable op lives here.
 */

import { getSupabaseClient } from '../utils/supabase'

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

export interface DisableFailedSubsParams {
  minFailures: number
  errorPattern: string
  subscriptionIds: string[] | null
}

export interface DisableFailedSubsResult {
  disabled_count: number
  subscription_ids: string[]
}

export async function disableFailedSubscriptions(
  client: AdminClient,
  params: DisableFailedSubsParams
): Promise<{ error: unknown } | { result: DisableFailedSubsResult }> {
  const { data, error } = await client.rpc('disable_failed_subscriptions', {
    p_min_failures: params.minFailures,
    p_error_pattern: params.errorPattern,
    p_subscription_ids: params.subscriptionIds
  })
  if (error) return { error }

  const row = Array.isArray(data) ? data[0] : data
  return {
    result: {
      disabled_count: row?.disabled_count ?? 0,
      subscription_ids: row?.subscription_ids ?? []
    }
  }
}
