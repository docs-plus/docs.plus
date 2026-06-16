import { config } from '../../config/env'
import { getServiceRoleClient } from '../../lib/supabase'

/** Service-role Supabase client (bypasses RLS); memoized. Null if not configured. */
export const getSupabaseClient = getServiceRoleClient

// Cap outbound PostgREST calls so a hung Supabase response can't pin a request.
const SUPABASE_FETCH_TIMEOUT_MS = 10_000

/**
 * PostgREST fetch with apikey + Authorization headers merged in (extra headers
 * win on conflict). Null when the service-role key is not configured.
 * @param path e.g. 'users?id=eq.123&select=id,email'
 */
export async function supabaseRest(path: string, init?: RequestInit): Promise<Response | null> {
  const url = config.supabase.url
  const key = config.supabase.serviceRoleKey
  if (!url || !key) return null

  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.headers as Record<string, string> | undefined)
    }
  })
}
