import { config } from '../../config/env'
import { getServiceRoleClient, SUPABASE_FETCH_TIMEOUT_MS } from '../../lib/supabase'

/** Service-role Supabase client (bypasses RLS); memoized. Null if not configured. */
export const getSupabaseClient = getServiceRoleClient

/**
 * PostgREST fetch with the service-role key merged into the headers (extra
 * headers win on conflict). Null when the service-role key is not configured.
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
      // An `sb_` key is not a JWT, so Supabase says to send it on `apikey`, not as a
      // Bearer token. A legacy JWT key keeps the Bearer header, because PostgREST
      // takes the role from Authorization.
      ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }),
      ...(init?.headers as Record<string, string> | undefined)
    }
  })
}
