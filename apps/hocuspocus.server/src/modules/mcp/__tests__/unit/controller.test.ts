import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import type { TokenVerifyOutcome } from '../../../../lib/auth'
import {
  createAuthenticate,
  createBearerCheck,
  createMcpRateLimit,
  createTransportHandler
} from '../../http/controller'
import { createRouter } from '../../http/router'
import type { CallerBudget } from '../../types'

// Unsigned: the stub verify below stands in for Supabase's signature check.
const jwt = (claims: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

const future = Math.floor(Date.now() / 1000) + 3600
const GOOD = jwt({ sub: 'u1', client_id: 'app', exp: future })
const INVALID = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 1 })
const UNAVAILABLE = jwt({ sub: 'u1', client_id: 'app', exp: future, n: 2 })
const BROWSER = jwt({ sub: 'u1', exp: future })
const EXPIRED = jwt({ sub: 'u1', client_id: 'app', exp: future - 7200 })

const makeVerify = () => {
  let calls = 0
  const verify = async (token: string): Promise<TokenVerifyOutcome> => {
    calls++
    if (token === INVALID) return { kind: 'invalid' }
    if (token === UNAVAILABLE) return { kind: 'unavailable' }
    return { kind: 'user', user: { sub: 'u1' } }
  }
  return { verify, getCalls: () => calls, reset: () => (calls = 0) }
}

const okBudget: CallerBudget = async () => ({ ok: true })

describe('createMcpRateLimit', () => {
  test('accepts verified OAuth bearer tokens on transport methods only', async () => {
    const { verify } = makeVerify()
    const rateLimit = createMcpRateLimit(createBearerCheck(verify), okBudget)
    const app = new Hono()
    app.all('*', async (c) => {
      const decision = await rateLimit(c, async () => c.req.header('X-Budget') !== 'spent')
      return c.json({
        kind: decision.kind,
        status: decision.kind === 'limited' ? decision.response.status : 200
      })
    })

    const ask = async (path: string, method: string, authorization?: string, budget = 'left') => {
      const res = await app.request(path, {
        method,
        headers: { 'X-Budget': budget, ...(authorization ? { Authorization: authorization } : {}) }
      })
      return ((await res.json()) as { kind: string }).kind
    }

    expect(await ask('/api/mcp', 'POST', `Bearer ${GOOD}`)).toBe('verified')
    expect(await ask('/api/mcp', 'POST', `bearer ${GOOD}`)).toBe('verified')
    expect(await ask('/api/mcp', 'POST', `BEARER ${GOOD}`)).toBe('verified')
    expect(await ask('/api/mcp', 'POST', `  BeArEr   ${GOOD}  `)).toBe('verified')
    expect(await ask('/api/mcp', 'GET', `Bearer ${GOOD}`)).toBe('verified')
    expect(await ask('/api/mcp', 'DELETE', `Bearer ${GOOD}`)).toBe('verified')

    expect(await ask('/api/mcp', 'POST')).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', `Basic ${GOOD}`)).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', `Bearer${GOOD}`)).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', 'bearer   ')).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', 'Bearer not-a-jwt')).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', `Bearer ${INVALID}`)).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', `Bearer ${BROWSER}`)).toBe('fallthrough')
    expect(await ask('/api/mcp', 'POST', `Bearer ${EXPIRED}`)).toBe('fallthrough')
    expect(
      await ask('/api/mcp/.well-known/oauth-protected-resource', 'GET', `Bearer ${GOOD}`)
    ).toBe('fallthrough')
    expect(await ask('/api/mcp', 'PUT', `Bearer ${GOOD}`)).toBe('fallthrough')
  })

  test('never verifies for an address with no global budget left', async () => {
    const { verify, getCalls } = makeVerify()
    const rateLimit = createMcpRateLimit(createBearerCheck(verify), okBudget)
    const app = new Hono()
    app.post('/api/mcp', async (c) => c.json(await rateLimit(c, async () => false)))

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}` }
    })
    expect(await res.json()).toEqual({ kind: 'fallthrough' })
    expect(getCalls()).toBe(0)
  })

  test('returns auth-unavailable on Auth 503 and shares checkBearer memoization', async () => {
    const { verify, getCalls } = makeVerify()
    const checkBearer = createBearerCheck(verify)
    const rateLimit = createMcpRateLimit(checkBearer, okBudget)
    const authenticate = createAuthenticate(null, checkBearer)

    const app = new Hono()
    app.post('/api/mcp', async (c) => {
      const decision = await rateLimit(c, async () => true)
      const auth = await authenticate(c)
      return c.json({
        decision: decision.kind,
        authStatus: auth instanceof Response ? auth.status : 200
      })
    })

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${UNAVAILABLE}` }
    })
    expect(await res.json()).toEqual({ decision: 'auth-unavailable', authStatus: 503 })
    expect(getCalls()).toBe(1)
  })

  test('returns 429 RATE_LIMIT_EXCEEDED with Retry-After when requestBudget is spent', async () => {
    const { verify } = makeVerify()
    const rateLimit = createMcpRateLimit(createBearerCheck(verify), async () => ({
      ok: false,
      retryAfter: 7
    }))
    const app = new Hono()
    let reachedRoute = 0
    app.use('*', async (c, next) => {
      const decision = await rateLimit(c, async () => true)
      if (decision.kind === 'limited') return decision.response
      await next()
    })
    app.post('/api/mcp', (c) => {
      reachedRoute++
      return c.text('ok')
    })

    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}` }
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('7')
    expect(await res.json()).toEqual({
      success: false,
      error: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' }
    })
    expect(reachedRoute).toBe(0)
  })
})

describe('full rate-limit dispatcher + router chain', () => {
  const buildChainApp = (opts?: {
    requestBudget?: CallerBudget
    auth503Points?: number
    globalPoints?: number
  }) => {
    const { verify } = makeVerify()
    const checkBearer = createBearerCheck(verify)
    let budgetCalls = 0
    const countingBudget: CallerBudget = async (sub) => {
      budgetCalls++
      return opts?.requestBudget ? opts.requestBudget(sub) : { ok: true }
    }
    const mcpRateLimit = createMcpRateLimit(checkBearer, countingBudget)

    let globalRemaining = opts?.globalPoints ?? 10
    let auth503Remaining = opts?.auth503Points ?? 10
    let globalCharges = 0
    let auth503Charges = 0

    const app = new Hono()
    app.use('*', async (c, next) => {
      const decision = await mcpRateLimit(c, async () => globalRemaining > 0)
      if (decision.kind === 'limited') return decision.response
      if (decision.kind === 'verified') return next()
      if (decision.kind === 'auth-unavailable') {
        auth503Charges++
        if (auth503Remaining <= 0) {
          return c.json(
            {
              success: false,
              error: { message: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
            },
            429
          )
        }
        auth503Remaining--
        return next()
      }
      globalCharges++
      if (globalRemaining <= 0) {
        return c.json(
          { success: false, error: { message: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' } },
          429
        )
      }
      globalRemaining--
      return next()
    })

    const { router, close } = createRouter({
      publicBaseUrl: null,
      authIssuer: 'https://auth.example/auth/v1',
      allowedOrigins: ['https://docs.plus'],
      checkBearer,
      factory: () => new McpServer({ name: 'test', version: '1.0.0' })
    })
    app.route('/api/mcp', router)

    return {
      app,
      close,
      counts: () => ({ budgetCalls, globalCharges, auth503Charges })
    }
  }

  test('charges mcp-req once per valid POST, including 403 foreign Origin and 413 oversized body', async () => {
    const chain = buildChainApp()
    const initPayload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    })

    const okRes = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GOOD}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: initPayload
    })
    expect(okRes.status).toBe(200)
    expect(chain.counts().budgetCalls).toBe(1)

    const originRes = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GOOD}`,
        Origin: 'https://evil.example',
        'Content-Type': 'application/json'
      },
      body: '{}'
    })
    expect(originRes.status).toBe(403)
    expect(chain.counts().budgetCalls).toBe(2)

    const bigBody = 'x'.repeat(1024 * 1024 + 10)
    const sizeRes = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GOOD}`,
        'Content-Type': 'application/json'
      },
      body: bigBody
    })
    expect(sizeRes.status).toBe(413)
    expect(chain.counts().budgetCalls).toBe(3)
    expect(chain.counts().globalCharges).toBe(0)

    await chain.close()
  })

  test('isolates Auth 503 into mcp-auth-503 without charging global bucket', async () => {
    const chain = buildChainApp({ auth503Points: 1 })

    const first = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${UNAVAILABLE}` }
    })
    expect(first.status).toBe(503)
    expect(chain.counts()).toEqual({ budgetCalls: 0, globalCharges: 0, auth503Charges: 1 })

    const second = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${UNAVAILABLE}` }
    })
    expect(second.status).toBe(429)
    expect(chain.counts()).toEqual({ budgetCalls: 0, globalCharges: 0, auth503Charges: 2 })

    const invalid = await chain.app.request('/api/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${INVALID}` }
    })
    expect(invalid.status).toBe(401)
    expect(chain.counts()).toEqual({ budgetCalls: 0, globalCharges: 1, auth503Charges: 2 })

    await chain.close()
  })
})

describe('createTransportHandler & createRouter transport hardening', () => {
  const buildTransport = () => {
    const { verify } = makeVerify()
    const checkBearer = createBearerCheck(verify)
    let factoryCalls = 0
    const { router, close } = createRouter({
      publicBaseUrl: null,
      authIssuer: 'https://auth.example/auth/v1',
      allowedOrigins: ['https://docs.plus'],
      checkBearer,
      factory: () => {
        factoryCalls++
        return new McpServer({ name: 'test', version: '1.0.0' })
      }
    })
    return { router, close, getFactoryCalls: () => factoryCalls }
  }

  test('GET and DELETE still reach handler and return 405 without Content-Type', async () => {
    const { router, close } = buildTransport()
    const getRes = await router.request('/', {
      method: 'GET',
      headers: { Authorization: `Bearer ${GOOD}` }
    })
    expect(getRes.status).toBe(405)

    const delRes = await router.request('/', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${GOOD}` }
    })
    expect(delRes.status).toBe(405)
    await close()
  })

  test('POST rejects non-JSON Content-Type with 415 and invalid JSON with 400 -32700', async () => {
    const { router, close, getFactoryCalls } = buildTransport()

    const plainRes = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'text/plain' },
      body: '{}'
    })
    expect(plainRes.status).toBe(415)
    expect(await plainRes.json()).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Unsupported Media Type: Content-Type must be application/json'
      },
      id: null
    })

    const badJson = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: '{bad'
    })
    expect(badJson.status).toBe(400)
    expect(await badJson.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error: Invalid JSON' },
      id: null
    })

    const emptyBody = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: ''
    })
    expect(emptyBody.status).toBe(400)
    expect(getFactoryCalls()).toBe(0)
    await close()
  })

  test('POST rejects JSON-RPC batch arrays and subscriptions/listen before handler.fetch', async () => {
    const { router, close, getFactoryCalls } = buildTransport()

    const batchRes = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    })
    expect(batchRes.status).toBe(400)
    expect(await batchRes.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'JSON-RPC batch requests are not supported' },
      id: null
    })

    const subWithId = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        method: 'subscriptions/listen',
        params: { notifications: {} }
      })
    })
    expect(subWithId.status).toBe(404)
    expect(await subWithId.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id: 42
    })

    const subNoId = await router.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'subscriptions/listen' })
    })
    expect(subNoId.status).toBe(404)
    expect(await subNoId.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id: null
    })

    expect(getFactoryCalls()).toBe(0)
    await close()
  })

  test('forwards parsedBody on valid POST and close() shuts down the handler', async () => {
    let seenParsedBody: unknown
    const transport = createTransportHandler(
      createAuthenticate(null, createBearerCheck(makeVerify().verify)),
      {
        fetch: async (_req, opts) => {
          seenParsedBody = opts?.parsedBody
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    )

    const app = new Hono().post('/', transport)
    const res = await app.request('/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GOOD}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    })
    expect(res.status).toBe(200)
    expect(seenParsedBody).toEqual({ jsonrpc: '2.0', id: 1, method: 'ping' })

    const { router, close } = buildTransport()
    await close()
    const afterClose = await router.request('/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GOOD}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    })
    expect(afterClose.status).toBe(500)
  })

  test('accepts case-insensitive Bearer schemes and rejects non-Bearer headers with 401 WWW-Authenticate', async () => {
    const { router, close } = buildTransport()

    for (const scheme of ['bearer', 'BEARER', 'BeArEr']) {
      const ok = await router.request('/', {
        method: 'GET',
        headers: { Authorization: `${scheme}   ${GOOD}  ` }
      })
      expect(ok.status).toBe(405)
    }

    for (const badHeader of [`Basic ${GOOD}`, `Bearer${GOOD}`, 'bearer   ']) {
      const denied = await router.request('/', {
        method: 'POST',
        headers: { Authorization: badHeader, 'Content-Type': 'application/json' },
        body: '{}'
      })
      expect(denied.status).toBe(401)
      expect(denied.headers.get('WWW-Authenticate')).toContain('Bearer resource_metadata=')
    }

    await close()
  })
})
