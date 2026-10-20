import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import type { TokenVerifyOutcome } from '../../../../lib/auth'
import { createVerifiedMcpCall } from '../../http/controller'

// Unsigned: the stub verify below stands in for Supabase's signature check.
const jwt = (claims: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

const future = Math.floor(Date.now() / 1000) + 3600
const GOOD = jwt({ sub: 'u1', client_id: 'app', exp: future })
const INVALID = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 1 })
const UNAVAILABLE = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 2 })
const BROWSER = jwt({ sub: 'u1', exp: future })
const EXPIRED = jwt({ sub: 'u1', client_id: 'app', exp: future - 7200 })

const verify = async (token: string): Promise<TokenVerifyOutcome> => {
  if (token === INVALID) return { kind: 'invalid' }
  if (token === UNAVAILABLE) return { kind: 'unavailable' }
  return { kind: 'user', user: { sub: 'u1' } }
}

const isVerified = createVerifiedMcpCall(verify)
const app = new Hono()
app.all('*', async (c) =>
  c.json({ verified: await isVerified(c, async () => c.req.header('X-Budget') !== 'spent') })
)

const ask = async (path: string, method: string, authorization?: string, budget = 'left') => {
  const res = await app.request(path, {
    method,
    headers: { 'X-Budget': budget, ...(authorization ? { Authorization: authorization } : {}) }
  })
  return ((await res.json()) as { verified: boolean }).verified
}

// A looser rule lets a fake header or a browser session skip the per-address limit.
describe('createVerifiedMcpCall', () => {
  test('accepts only a token createAuthenticate would accept, on the transport', async () => {
    expect(await ask('/api/mcp', 'POST', `Bearer ${GOOD}`)).toBe(true)

    expect(await ask('/api/mcp', 'POST')).toBe(false)
    expect(await ask('/api/mcp', 'POST', 'Bearer not-a-jwt')).toBe(false)
    expect(await ask('/api/mcp', 'POST', `Bearer ${INVALID}`)).toBe(false)
    expect(await ask('/api/mcp', 'POST', `Bearer ${UNAVAILABLE}`)).toBe(false)
    expect(await ask('/api/mcp', 'POST', `Bearer ${BROWSER}`)).toBe(false)
    expect(await ask('/api/mcp', 'POST', `Bearer ${EXPIRED}`)).toBe(false)
  })

  test('never skips the limit off the transport route', async () => {
    expect(
      await ask('/api/mcp/.well-known/oauth-protected-resource', 'GET', `Bearer ${GOOD}`)
    ).toBe(false)
    expect(await ask('/api/mcp', 'PUT', `Bearer ${GOOD}`)).toBe(false)
  })

  // Verify can call Supabase Auth, so a spent address must be charged before it.
  test('never skips the limit for an address with no budget left', async () => {
    expect(await ask('/api/mcp', 'POST', `Bearer ${GOOD}`, 'spent')).toBe(false)
  })
})
