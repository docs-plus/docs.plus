import type { OAuthGrant } from '@supabase/supabase-js'

import { appTrust, clientTrust, groupApps } from './appTrust'

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback'
const CHATGPT = 'https://chatgpt.com/connector/oauth/abc-123'
const LOCAL = 'http://localhost:6274/oauth/callback'
const EVIL = 'https://evil.com/callback'

const claude = { kind: 'known', app: 'claude', name: 'Claude', host: 'claude.ai' }

function grant(id: string, name: string, granted_at: string): OAuthGrant {
  return { client: { id, name, uri: '', logo_uri: '' }, scopes: [], granted_at }
}

describe('appTrust', () => {
  it('knows the exact Claude callback on both hosts', () => {
    expect(appTrust(CLAUDE)).toEqual(claude)
    expect(appTrust('https://claude.com/api/mcp/auth_callback')).toEqual({
      ...claude,
      host: 'claude.com'
    })
  })

  it('does not know a Claude lookalike', () => {
    expect(appTrust('http://claude.ai/api/mcp/auth_callback')).toEqual({
      kind: 'unknown',
      origin: 'http://claude.ai'
    })
    expect(appTrust('https://claude.ai.evil.com/api/mcp/auth_callback')).toEqual({
      kind: 'unknown',
      origin: 'https://claude.ai.evil.com'
    })
    expect(appTrust('https://claude.ai/api/mcp/auth_callback/x')).toEqual({
      kind: 'unknown',
      origin: 'https://claude.ai'
    })
    expect(appTrust('https://claude.ai:8443/api/mcp/auth_callback')).toEqual({
      kind: 'unknown',
      origin: 'https://claude.ai:8443'
    })
  })

  it('reads the host after the userinfo', () => {
    expect(appTrust('https://claude.ai@evil.com/api/mcp/auth_callback')).toEqual({
      kind: 'unknown',
      origin: 'https://evil.com'
    })
    // The browser still sends the code to claude.ai, so this one is safe.
    expect(appTrust('https://evil.com@claude.ai/api/mcp/auth_callback')).toEqual(claude)
  })

  it('knows a ChatGPT callback with one connector id', () => {
    expect(appTrust(CHATGPT)).toEqual({
      kind: 'known',
      app: 'chatgpt',
      name: 'ChatGPT',
      host: 'chatgpt.com'
    })
    expect(appTrust('https://chatgpt.com/connector/oauth/a/b')).toEqual({
      kind: 'unknown',
      origin: 'https://chatgpt.com'
    })
    expect(appTrust('https://chatgpt.com/connector/oauth/')).toEqual({
      kind: 'unknown',
      origin: 'https://chatgpt.com'
    })
  })

  it('marks an http loopback callback as local', () => {
    expect(appTrust(LOCAL)).toEqual({ kind: 'local', origin: 'http://localhost:6274' })
    expect(appTrust('http://127.0.0.1/callback')).toEqual({
      kind: 'local',
      origin: 'http://127.0.0.1'
    })
    expect(appTrust('http://[::1]:3000/callback')).toEqual({
      kind: 'local',
      origin: 'http://[::1]:3000'
    })
  })

  it('does not mark a loopback lookalike as local', () => {
    expect(appTrust('http://localhost.evil.com/callback')).toEqual({
      kind: 'unknown',
      origin: 'http://localhost.evil.com'
    })
    expect(appTrust('ftp://localhost/callback')).toEqual({
      kind: 'unknown',
      origin: 'ftp://localhost'
    })
  })

  it('shows scheme and host for a custom scheme or a bad URI', () => {
    expect(appTrust('cursor://anysphere.cursor-retrieval/oauth/callback')).toEqual({
      kind: 'unknown',
      origin: 'cursor://anysphere.cursor-retrieval'
    })
    expect(appTrust('vscode://vscode.github-authentication/did-authenticate')).toEqual({
      kind: 'unknown',
      origin: 'vscode://vscode.github-authentication'
    })
    expect(appTrust('not a url')).toEqual({ kind: 'unknown', origin: 'not a url' })
  })
})

describe('clientTrust', () => {
  it('gives the least trusted state', () => {
    expect(clientTrust([CLAUDE, LOCAL])).toEqual({ kind: 'local', origin: 'http://localhost:6274' })
    expect(clientTrust([CLAUDE, EVIL])).toEqual({ kind: 'unknown', origin: 'https://evil.com' })
    expect(clientTrust([CLAUDE, LOCAL, EVIL])).toEqual({
      kind: 'unknown',
      origin: 'https://evil.com'
    })
  })

  it('gives unknown for no URIs or for two known apps', () => {
    expect(clientTrust([])).toEqual({ kind: 'unknown', origin: '' })
    expect(clientTrust([CLAUDE, CHATGPT])).toEqual({ kind: 'unknown', origin: '' })
  })

  it('keeps one known app across its hosts', () => {
    expect(clientTrust([CLAUDE, 'https://claude.com/api/mcp/auth_callback'])).toEqual(claude)
  })
})

describe('groupApps', () => {
  it('merges real Claude clients and keeps the newest grant time', () => {
    const grants = [
      grant('c1', 'Claude', '2026-09-01T00:00:00Z'),
      grant('c2', 'claude-desktop', '2026-09-20T00:00:00Z')
    ]
    expect(groupApps({ grants, redirects: { c1: [CLAUDE], c2: [CLAUDE] } })).toEqual([
      {
        key: 'known:Claude',
        name: 'Claude',
        trust: claude,
        clientIds: ['c1', 'c2'],
        grantedAt: '2026-09-20T00:00:00Z'
      }
    ])
  })

  it('gives a borrowed name its own row', () => {
    const grants = [
      grant('c1', 'Claude', '2026-09-01T00:00:00Z'),
      grant('evil', 'Claude', '2026-09-02T00:00:00Z')
    ]
    expect(groupApps({ grants, redirects: { c1: [CLAUDE], evil: [EVIL] } })).toEqual([
      {
        key: 'unknown:Claude',
        name: 'Claude',
        trust: { kind: 'unknown', origin: 'https://evil.com' },
        clientIds: ['evil'],
        grantedAt: '2026-09-02T00:00:00Z'
      },
      {
        key: 'known:Claude',
        name: 'Claude',
        trust: claude,
        clientIds: ['c1'],
        grantedAt: '2026-09-01T00:00:00Z'
      }
    ])
  })

  it('gives unknown with no redirects, newest first', () => {
    const grants = [
      grant('a', 'App A', '2026-09-01T00:00:00Z'),
      grant('b', 'App B', '2026-09-03T00:00:00Z'),
      grant('c', 'App C', '2026-09-02T00:00:00Z')
    ]
    expect(groupApps({ grants, redirects: {} })).toEqual([
      {
        key: 'unknown:App B',
        name: 'App B',
        trust: { kind: 'unknown', origin: '' },
        clientIds: ['b'],
        grantedAt: '2026-09-03T00:00:00Z'
      },
      {
        key: 'unknown:App C',
        name: 'App C',
        trust: { kind: 'unknown', origin: '' },
        clientIds: ['c'],
        grantedAt: '2026-09-02T00:00:00Z'
      },
      {
        key: 'unknown:App A',
        name: 'App A',
        trust: { kind: 'unknown', origin: '' },
        clientIds: ['a'],
        grantedAt: '2026-09-01T00:00:00Z'
      }
    ])
  })
})
