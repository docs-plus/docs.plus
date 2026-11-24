import { describe, expect, test } from 'bun:test'
import type { MiddlewareHandler } from 'hono'

import { fail } from '../../../../http/envelope'
import { userRateLimiter } from '../../../../middleware'
import type { RedisClient } from '../../../../types/redis.types'
import { createConnectedAppsRouter } from '../../http/connectedApps'

const VALID_CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000'

const makeMemoryRateLimitRedis = (): RedisClient => {
  const counts = new Map<string, number>()
  return {
    defineCommand: () => {},
    rlflxIncr: async (args: [string, string, string, string, string]) => {
      const [key, pointsToConsume, secDuration] = args
      const next = (counts.get(key) ?? 0) + Number(pointsToConsume)
      counts.set(key, next)
      return [next, Number(secDuration) * 1000]
    }
  } as unknown as RedisClient
}

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
      clientRedirects: async () => ['https://claude.ai/api/mcp/auth_callback']
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      success: false,
      error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
    })
  })

  test('rejects anonymous users with 403 without spending budget or reading client', async () => {
    let rateLimitCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsRateLimit: async (_c, next) => {
        rateLimitCalls++
        await next()
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
    expect(rateLimitCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('rejects connected-app tokens with 403 without spending budget or reading client', async () => {
    let rateLimitCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsRateLimit: async (_c, next) => {
        rateLimitCalls++
        await next()
      },
      requireUser: makeFakeRequireUser()
    })

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`, {
      headers: { 'X-Test-Auth': 'connected-app' }
    })
    expect(res.status).toBe(403)
    expect(rateLimitCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('rejects non-UUID clientId with 400 VALIDATION_ERROR without spending budget', async () => {
    let rateLimitCalls = 0
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return []
      },
      clientRedirectsRateLimit: async (_c, next) => {
        rateLimitCalls++
        await next()
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
    expect(rateLimitCalls).toBe(0)
    expect(lookupCalls).toBe(0)
  })

  test('returns 429 RATE_LIMIT_EXCEEDED with Retry-After and X-RateLimit-* when user rate limit is spent', async () => {
    let lookupCalls = 0
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async () => {
        lookupCalls++
        return ['https://claude.ai/api/mcp/auth_callback']
      },
      clientRedirectsRateLimit: userRateLimiter({
        points: 1,
        duration: 60,
        keyPrefix: 'mcp-client-redirects',
        storeClient: makeMemoryRateLimitRedis()
      }),
      requireUser: makeFakeRequireUser()
    })

    const first = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(first.status).toBe(200)

    const res = await router.request(`/clients/${VALID_CLIENT_ID}/redirects`)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Limit')).toBe('1')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(await res.json()).toEqual({
      success: false,
      error: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' }
    })
    expect(lookupCalls).toBe(1)
  })

  test('returns redirects in house envelope for valid user and UUID', async () => {
    let seenClientId = ''
    const router = createConnectedAppsRouter({
      grantRedirects: async () => ({}),
      clientRedirects: async (clientId) => {
        seenClientId = clientId
        return ['https://claude.ai/api/mcp/auth_callback']
      },
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
