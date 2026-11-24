import { describe, expect, test } from 'bun:test'
import type { MiddlewareHandler } from 'hono'

import { fail } from '../../../../http/envelope'
import { createConnectedAppsRouter } from '../../http/connectedApps'

const VALID_CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000'

const makeFakeRequireUser = (): MiddlewareHandler => async (c, next) => {
  const mode = c.req.header('X-Test-Auth') ?? 'user'
  if (mode === 'missing') {
    return fail(c, 401, 'UNAUTHORIZED', 'Authentication required')
  }
  if (mode === 'connected-app') {
    return fail(c, 403, 'FORBIDDEN', 'Connected apps can use only /api/mcp')
  }
  if (mode === 'anonymous') {
    c.set('userId', 'anon-1')
    c.set('user', { sub: 'anon-1', is_anonymous: true })
    await next()
    return
  }
  c.set('userId', 'user-1')
  c.set('user', { sub: 'user-1', is_anonymous: false })
  await next()
}

describe('connectedAppsRouter GET /clients/:clientId/redirects', () => {
  test('default requireUser rejects missing token with 401 UNAUTHORIZED', async () => {
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => ['https://claude.ai/api/mcp/auth_callback'],
      clientRedirectsBudget: async () => ({ ok: true })
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      success: false,
      error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
    })
  })

  test('rejects anonymous users with 403 without spending budget or reading client', async () => {
    let budgetCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsBudget: async () => {
        budgetCalls++
        return { ok: true }
      },
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`, {
      headers: { 'X-Test-Auth': 'anonymous' }
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      success: false,
      error: {
        message: 'Anonymous users cannot read connected app redirects',
        code: 'FORBIDDEN'
      }
    })
    expect(budgetCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('rejects connected-app tokens with 403 without spending budget or reading client', async () => {
    let budgetCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsBudget: async () => {
        budgetCalls++
        return { ok: true }
      },
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`, {
      headers: { 'X-Test-Auth': 'connected-app' }
    })
    expect(res.status).toBe(403)
    expect(budgetCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('rejects non-UUID clientId with 400 VALIDATION_ERROR without spending budget', async () => {
    let budgetCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsBudget: async () => {
        budgetCalls++
        return { ok: true }
      },
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request('/clients/not-a-uuid/redirects')
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      success: boolean
      error: { code: string; fields: { path: string }[] }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields.map((f) => f.path)).toContain('clientId')
    expect(budgetCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('returns 429 RATE_LIMIT_EXCEEDED with Retry-After when budget is spent', async () => {
    let lookupCalls = 0
    let seenSub = ''
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsBudget: async (sub) => {
        seenSub = sub
        return { ok: false, retryAfter: 42 }
      },
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(seenSub).toBe('user-1')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(await res.json()).toEqual({
      success: false,
      error: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' }
    })
    expect(lookupCalls).toBe(0)
  })

  test('returns redirects in house envelope for valid user and UUID', async () => {
    let seenClientId = ''
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async (clientId) => {
        seenClientId = clientId
        return ['https://claude.ai/api/mcp/auth_callback']
      },
      clientRedirectsBudget: async () => ({ ok: true }),
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(res.status).toBe(200)
    expect(seenClientId).toBe(VALID_CLIENT_ID)
    expect(await res.json()).toEqual({
      success: true,
      data: { redirects: ['https://claude.ai/api/mcp/auth_callback'] }
    })
  })
})
