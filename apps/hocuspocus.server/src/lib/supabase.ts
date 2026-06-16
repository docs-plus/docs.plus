import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { config } from '../config/env'

// Single memoized clients instead of per-call createClient across the codebase.

let serviceRoleClient: SupabaseClient | null = null
/** Service-role client (bypasses RLS). Null if URL/key not configured. */
export const getServiceRoleClient = (): SupabaseClient | null => {
  if (serviceRoleClient) return serviceRoleClient
  const { url, serviceRoleKey } = config.supabase
  if (!url || !serviceRoleKey) return null
  serviceRoleClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  return serviceRoleClient
}

let anonClient: SupabaseClient | null = null
/** Anon client (RLS-scoped); used for user-token verification. Null if unconfigured. */
export const getAnonClient = (): SupabaseClient | null => {
  if (anonClient) return anonClient
  const { url, anonKey } = config.supabase
  if (!url || !anonKey) return null
  anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return anonClient
}
