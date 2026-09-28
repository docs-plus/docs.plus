import type { OAuthGrant } from '@supabase/supabase-js'

import type { AiAppId } from './aiAppBrands'
import { displayClientName } from './displayClientName'

// An app picks its own name, but only the real host can receive a code sent to its
// callback. So trust follows the exact redirect URI, never the name.
const KNOWN_APPS: { app: AiAppId; name: string; matches: (url: URL) => boolean }[] = [
  {
    app: 'claude',
    name: 'Claude',
    // Anthropic documents claude.com as the future callback.
    matches: (url) =>
      (url.origin === 'https://claude.ai' || url.origin === 'https://claude.com') &&
      url.pathname === '/api/mcp/auth_callback'
  },
  {
    app: 'chatgpt',
    name: 'ChatGPT',
    // The last path segment is a per-connector id.
    matches: (url) =>
      url.origin === 'https://chatgpt.com' && /^\/connector\/oauth\/[\w-]+$/.test(url.pathname)
  }
]

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const ORIGIN_TEXT_MAX = 80

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

export function appTrust(redirectUri: string): AppTrust {
  const url = parse(redirectUri)
  const known = url && KNOWN_APPS.find((app) => app.matches(url))
  if (known) return { kind: 'known', app: known.app, name: known.name, host: url.host }
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
  return { kind: 'unknown', origin: '' }
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
