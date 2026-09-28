import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from 'pino'

import { SUPABASE_FETCH_TIMEOUT_MS } from '../../../lib/supabase'

interface GrantRedirectsDeps {
  supabase: SupabaseClient | null
  supabaseUrl: string | null
  supabaseKey: string | null
  logger: Logger
}

/** Registered redirect URIs per app, keyed by OAuth `client_id`. */
export type GrantRedirects = (token: string | undefined) => Promise<Record<string, string[]>>

/** The caller's own grants, read with the caller's token, so no one reads another person's apps. */
async function grantClientIds(url: string, apikey: string, token: string): Promise<string[]> {
  const res = await fetch(`${url}/auth/v1/user/oauth/grants`, {
    signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
    headers: { apikey, Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`grants answered ${res.status}`)
  const grants = (await res.json()) as { client: { id: string } }[]
  return grants.map((grant) => grant.client.id)
}

/**
 * Grants omit redirect URIs, and the webapp needs them to tell a known app from
 * one that only uses a known name. Any failure answers an empty map, so the
 * webapp shows every app as unverified and Disconnect stays visible.
 */
export const createGrantRedirects =
  ({ supabase, supabaseUrl, supabaseKey, logger }: GrantRedirectsDeps): GrantRedirects =>
  async (token) => {
    const redirects: Record<string, string[]> = {}
    if (!supabase || !supabaseUrl || !supabaseKey || !token) return redirects
    try {
      const clientIds = await grantClientIds(supabaseUrl.replace(/\/+$/, ''), supabaseKey, token)
      const clients = await Promise.all(
        clientIds.map((clientId) => supabase.auth.admin.oauth.getClient(clientId))
      )
      for (const { data } of clients) {
        if (data) redirects[data.client_id] = data.redirect_uris
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to read connected app redirects')
    }
    return redirects
  }
