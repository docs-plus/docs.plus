/**
 * Shared Supabase Utilities for Admin Controllers
 *
 * Centralizes service-role client creation and PostgREST fetch helper.
 * Eliminates repeated `process.env` reads and auth header boilerplate.
 */

import { createClient } from '@supabase/supabase-js'

import { config } from '../../config/env'

/**
 * Supabase client with service_role key (bypasses RLS).
 * Returns null if service role key is not configured.
 */
export const getSupabaseClient = () => {
  const url = config.supabase.url
  const key = config.supabase.serviceRoleKey
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Convenience wrapper for Supabase PostgREST calls.
 * Adds apikey + Authorization headers automatically.
 * Returns null if Supabase service role key is not configured.
 *
 * @param path - PostgREST path (e.g. 'users?id=eq.123&select=id,email')
 * @param init - Standard fetch RequestInit (extra headers are merged, not replaced)
 */
export async function supabaseRest(path: string, init?: RequestInit): Promise<Response | null> {
  const url = config.supabase.url
  const key = config.supabase.serviceRoleKey
  if (!url || !key) return null

  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.headers as Record<string, string> | undefined)
    }
  })
}
