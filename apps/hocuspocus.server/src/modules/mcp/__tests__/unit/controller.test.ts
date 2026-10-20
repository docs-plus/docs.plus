import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import type { TokenVerifyOutcome } from '../../../../lib/auth'
import {
  createAuthenticate,
  createBearerCheck,
  createTransportHandler,
  createVerifiedMcpCall
} from '../../http/controller'

// Unsigned: the stub verify below stands in for Supabase's signature check.
const jwt = (claims: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

const future = Math.floor(Date.now() / 1000) + 3600
const GOOD = jwt({ sub: 'u1', client_id: 'app', exp: future })
const INVALID = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 1 })
const UNAVAILABLE = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 2 })
const BROWSER = jwt({ sub: 'u1', exp: future })
const EXPIRED = jwt({ sub: 'u1', client_id: 'app', exp: future - 7200 })

// Counted: a verify can be a Supabase Auth call, which a spent address must never reach.
let verifyCalls = 0
const verify = async (token: string): Promise<TokenVerifyOutcome> => {
  verifyCalls++
  if (token === INVALID) return { kind: 'invalid' }
  if (token === UNAVAILABLE) return { kind: 'unavailable' }
  return { kind: 'user', user: { sub: 'u1' } }
}

const isVerified = createVerifiedMcpCall(createBearerCheck(verify))
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

  test('never verifies for an address with no budget left', async () => {
    verifyCalls = 0
    expect(await ask('/api/mcp', 'POST', `Bearer ${GOOD}`, 'spent')).toBe(false)
    expect(verifyCalls).toBe(0)
  })
})

// Without it, a verified caller's `initialize` and `tools/list` had no app bound at all.
describe('createTransportHandler', () => {
  test('a spent person gets 429 and never reaches the MCP handler', async () => {
    let handled = 0
    const transport = createTransportHandler(
      createAuthenticate(null, createBearerCheck(verify)),
      async () => ({ ok: false, retryAfter: 7 }),
      {
        fetch: async () => {
          handled++
          return new Response('handled')
        }
      }
    )
    const res = await new Hono()
      .post('/api/mcp', transport)
      .request('/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${GOOD}` } })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('7')
    expect(handled).toBe(0)
  })
})
