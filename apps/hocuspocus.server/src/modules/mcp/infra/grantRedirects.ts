import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from 'pino'

import { SUPABASE_FETCH_TIMEOUT_MS } from '../../../lib/supabase'

export const GRANT_LOOKUP_CONCURRENCY = 8
export const MAX_GRANT_CLIENT_LOOKUPS = 100

type GrantFetch = (input: string, init?: RequestInit) => Promise<Response>

interface GrantRedirectsDeps {
  supabase: SupabaseClient | null
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  logger: Logger
  fetchImpl?: GrantFetch
}

/** Registered redirect URIs per app, keyed by OAuth `client_id`. */
export type GrantRedirects = (token: string | undefined) => Promise<Record<string, string[]>>

/** Registered redirect URIs for one OAuth `client_id`. Returns `[]` on 404 or error. */
export type ClientRedirects = (clientId: string) => Promise<string[]>

/** The caller's own grants, read with the caller's token, so no one reads another person's apps. */
async function grantClientIds(
  url: string,
  apikey: string,
  token: string,
  fetchImpl: GrantFetch
): Promise<string[]> {
  const res = await fetchImpl(`${url}/auth/v1/user/oauth/grants`, {
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
  ({
    supabase,
    supabaseUrl,
    supabaseAnonKey,
    logger,
    fetchImpl = fetch
  }: GrantRedirectsDeps): GrantRedirects =>
  async (token) => {
    const redirects: Record<string, string[]> = {}
    if (!supabase || !supabaseUrl || !supabaseAnonKey || !token) return redirects
    try {
      const clientIds = await grantClientIds(
        supabaseUrl.replace(/\/+$/, ''),
        supabaseAnonKey,
        token,
        fetchImpl
      )
      const uniqueIds = [...new Set(clientIds)]
      if (uniqueIds.length > MAX_GRANT_CLIENT_LOOKUPS) {
        logger.warn(
          { total: uniqueIds.length, cap: MAX_GRANT_CLIENT_LOOKUPS },
          'Capping connected app redirect lookups'
        )
      }
      const cappedIds = uniqueIds.slice(0, MAX_GRANT_CLIENT_LOOKUPS)
      let nextIndex = 0
      const workerCount = Math.min(GRANT_LOOKUP_CONCURRENCY, cappedIds.length)
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (nextIndex < cappedIds.length) {
            const clientId = cappedIds[nextIndex++]
            if (!clientId) continue
            try {
              const { data, error } = await supabase.auth.admin.oauth.getClient(clientId)
              if (error) {
                logger.warn({ err: error, clientId }, 'Failed to read OAuth client redirects')
                continue
              }
              if (data && typeof data.client_id === 'string' && Array.isArray(data.redirect_uris)) {
                redirects[data.client_id] = data.redirect_uris.filter(
                  (u): u is string => typeof u === 'string'
                )
              }
            } catch (err) {
              logger.warn({ err, clientId }, 'Failed to read OAuth client redirects')
            }
          }
        })
      )
    } catch (err) {
      logger.warn({ err }, 'Failed to read connected app redirects')
    }
    return redirects
  }

interface ClientRedirectsDeps {
  supabase: SupabaseClient | null
  logger: Logger
}

/** Registered redirect URIs for one `client_id`. Returns `[]` on missing client or failure. */
export const createClientRedirects =
  ({ supabase, logger }: ClientRedirectsDeps): ClientRedirects =>
  async (clientId) => {
    if (!supabase) return []
    try {
      const { data, error } = await supabase.auth.admin.oauth.getClient(clientId)
      if (error || !data || !Array.isArray(data.redirect_uris)) {
        if (error) {
          logger.warn({ err: error, clientId }, 'Failed to read OAuth client redirects')
        }
        return []
      }
      return data.redirect_uris.filter((u): u is string => typeof u === 'string')
    } catch (err) {
      logger.warn({ err, clientId }, 'Failed to read OAuth client redirects')
      return []
    }
  }
