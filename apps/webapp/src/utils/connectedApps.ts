import type { Redirects } from './appTrust'
import { supabaseClient } from './supabase'

const CONNECTED_APPS_TIMEOUT_MS = 8_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function filterStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readRedirectsField(json: unknown): unknown {
  if (!isRecord(json) || !isRecord(json.data)) return undefined
  return json.data.redirects
}

async function fetchConnectedAppsJson(path: string): Promise<unknown> {
  const apiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL
  if (!apiUrl) return null
  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession()
    if (!session) return null
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { token: session.access_token },
      signal: AbortSignal.timeout(CONNECTED_APPS_TIMEOUT_MS)
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

/** Registered redirect URIs for one OAuth client, or `[]` when unavailable. */
export async function fetchClientRedirects(clientId: string): Promise<string[]> {
  const json = await fetchConnectedAppsJson(
    `/connected-apps/clients/${encodeURIComponent(clientId)}/redirects`
  )
  return filterStringArray(readRedirectsField(json))
}

/**
 * Registered redirect URIs per granted OAuth client, or `{}` when unavailable.
 * Failures return `{}` so every app stays unverified and Disconnect stays visible.
 */
export async function fetchGrantRedirects(): Promise<Redirects> {
  const json = await fetchConnectedAppsJson('/connected-apps/redirects')
  const raw = readRedirectsField(json)
  if (!isRecord(raw)) return {}
  const redirects: Redirects = {}
  for (const [clientId, uris] of Object.entries(raw)) {
    if (Array.isArray(uris)) {
      redirects[clientId] = filterStringArray(uris)
    }
  }
  return redirects
}
