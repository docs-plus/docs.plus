import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { config } from '../config/env'
import { logger } from './logger'

// Single memoized clients instead of per-call createClient across the codebase.

/** Default per-request deadline for every Supabase call, `supabaseRest` included. */
export const SUPABASE_FETCH_TIMEOUT_MS = 10_000

// A caller-supplied signal wins, so the health probe keeps its own 2 s bound.
// This sits on `global.fetch` rather than the PostgREST `db.timeout` option,
// because `auth.getUser` never reaches that one.
const timedFetch = (client: 'service-role' | 'anon'): typeof fetch => {
  const timed = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (init?.signal) return fetch(input, init)

    // An AbortController, not AbortSignal.timeout: postgrest-js re-runs a
    // TimeoutError three more times, so a 10 s bound would cost 47 s per call.
    // Only an AbortError ends its retry loop, which is what abort() raises.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS)

    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } catch (error) {
      // Only the deadline, never a DNS or connection-refused failure.
      if (controller.signal.aborted) {
        logger.error(
          { module: 'supabase', client, timeoutMs: SUPABASE_FETCH_TIMEOUT_MS },
          'Supabase request timed out'
        )
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  // Bun's `fetch` type carries `preconnect`; supabase-js asks for the whole type.
  return Object.assign(timed, { preconnect: fetch.preconnect })
}

let serviceRoleClient: SupabaseClient | null = null
/** Service-role client (bypasses RLS). Null if URL/key not configured. */
export const getServiceRoleClient = (): SupabaseClient | null => {
  if (serviceRoleClient) return serviceRoleClient
  const { url, serviceRoleKey } = config.supabase
  if (!url || !serviceRoleKey) return null
  serviceRoleClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: timedFetch('service-role') }
  })
  return serviceRoleClient
}

let anonClient: SupabaseClient | null = null
/** Anon client (RLS-scoped); used for user-token verification. Null if unconfigured. */
export const getAnonClient = (): SupabaseClient | null => {
  if (anonClient) return anonClient
  const { url, anonKey } = config.supabase
  if (!url || !anonKey) return null
  anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch('anon') }
  })
  return anonClient
}
