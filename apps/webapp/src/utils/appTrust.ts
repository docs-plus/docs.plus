import type { OAuthGrant } from '@supabase/supabase-js'

import { AI_APP_BRANDS, type AiAppId } from './aiAppBrands'
import { displayClientName } from './displayClientName'

// An app picks its own name, but only the real host can receive a code sent to its
// callback. So trust follows the exact redirect URI, never the name.
const KNOWN_APPS: { app: AiAppId; matches: (url: URL) => boolean }[] = [
  {
    app: 'claude',
    // Anthropic documents claude.com as the future callback.
    matches: (url) =>
      (url.origin === 'https://claude.ai' || url.origin === 'https://claude.com') &&
      url.pathname === '/api/mcp/auth_callback'
  },
  {
    app: 'chatgpt',
    // The last path segment is a per-connector id.
    matches: (url) =>
      url.origin === 'https://chatgpt.com' && /^\/connector\/oauth\/[\w-]+$/.test(url.pathname)
  },
  {
    app: 'cursor',
    // Read from production clients on 2026-10-20. Cursor DCR clients also register a loopback
    // URI, so both /oauth/consent and Settings downgrade them to "On this computer" (local).
    matches: (url) =>
      url.origin === 'https://www.cursor.com' && url.pathname === '/agents/mcp/oauth/callback'
  }
]

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const ORIGIN_TEXT_MAX = 80
// Supabase refuses these schemes at registration. Checked again because we call assign().
// A blocklist, not an allowlist: native and MCP clients register custom-scheme redirects.
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:'])

export type AppTrust =
  | { kind: 'known'; app: AiAppId; name: string; host: string }
  // Any program on the computer can listen on a loopback port.
  | { kind: 'local'; origin: string }
  | { kind: 'unknown'; origin: string }

function parse(uri: string): URL | null {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}

function originText(uri: string, url: URL | null): string {
  if (!url) return uri.slice(0, ORIGIN_TEXT_MAX)
  return url.origin !== 'null' ? url.origin : `${url.protocol}//${url.host}`
}

export function originOf(uri: string): string {
  return originText(uri, parse(uri))
}

/** Returns null for a scheme that could run script in this origin. */
export function parseSafeRedirectUrl(url: string): URL | null {
  const parsed = parse(url)
  // The parser strips tabs and newlines as the browser does, so `java\tscript:` is caught.
  if (!parsed || BLOCKED_PROTOCOLS.has(parsed.protocol)) return null
  return parsed
}

export function appTrust(redirectUri: string): AppTrust {
  const url = parse(redirectUri)
  const known = url && KNOWN_APPS.find((app) => app.matches(url))
  if (known)
    return { kind: 'known', app: known.app, name: AI_APP_BRANDS[known.app].name, host: url.host }
  if (url && /^https?:$/.test(url.protocol) && LOOPBACK_HOSTS.has(url.hostname)) {
    return { kind: 'local', origin: url.origin }
  }
  return { kind: 'unknown', origin: originText(redirectUri, url) }
}

/** A client with several redirect URIs is only as trusted as its least trusted one. */
export function clientTrust(redirectUris: string[]): AppTrust {
  const states = redirectUris.map(appTrust)
  const weakest =
    states.find((state) => state.kind === 'unknown') ??
    states.find((state) => state.kind === 'local')
  if (weakest) return weakest
  const [first] = states
  // Two known apps on one client is not either of them.
  if (
    first?.kind === 'known' &&
    states.every((state) => state.kind === 'known' && state.name === first.name)
  ) {
    return first
  }
  return { kind: 'unknown', origin: redirectUris[0] ? originOf(redirectUris[0]) : '' }
}

export type AutoRedirectDecision =
  | { kind: 'invalid' }
  | { kind: 'redirect'; url: string }
  | { kind: 'confirm'; url: string; origin: string }

export function resolveAutoRedirect(url: string): AutoRedirectDecision {
  const parsed = parseSafeRedirectUrl(url)
  if (!parsed) return { kind: 'invalid' }
  const trust = appTrust(parsed.href)
  if (trust.kind === 'known' || trust.kind === 'local') {
    return { kind: 'redirect', url: parsed.href }
  }
  return { kind: 'confirm', url: parsed.href, origin: trust.origin }
}

export function resolveConsentTrust(
  redirectUri: string,
  registeredRedirects: string[]
): { trust: AppTrust; activeOrigin: string; extraOrigins: string[] } {
  const activeOrigin = originOf(redirectUri)
  if (registeredRedirects.length === 0) {
    return { trust: { kind: 'unknown', origin: activeOrigin }, activeOrigin, extraOrigins: [] }
  }
  const trust = clientTrust(Array.from(new Set([redirectUri, ...registeredRedirects])))
  const extraOrigins = Array.from(
    new Set(registeredRedirects.map(originOf).filter((origin) => origin && origin !== activeOrigin))
  )
  return { trust, activeOrigin, extraOrigins }
}

export type Redirects = Record<string, string[]>

// One row per client name and trust state. DCR registers a new client for each fresh connection.
export interface ConnectedAppGroup {
  key: string
  name: string
  trust: AppTrust
  clientIds: string[]
  grantedAt: string
}

// An app that only borrows a known name gets its own row, apart from the real one.
export function groupApps({ grants, redirects }: { grants: OAuthGrant[]; redirects: Redirects }) {
  const groups = new Map<string, ConnectedAppGroup>()
  for (const grant of grants) {
    const uris = redirects[grant.client.id]
    const trust: AppTrust = uris?.length ? clientTrust(uris) : { kind: 'unknown', origin: '' }
    const name = trust.kind === 'known' ? trust.name : displayClientName(grant.client.name ?? '')
    const key = `${trust.kind}:${name}`
    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        key,
        name,
        trust,
        clientIds: [grant.client.id],
        grantedAt: grant.granted_at
      })
      continue
    }
    group.clientIds.push(grant.client.id)
    if (grant.granted_at > group.grantedAt) group.grantedAt = grant.granted_at
  }
  return [...groups.values()].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
}
