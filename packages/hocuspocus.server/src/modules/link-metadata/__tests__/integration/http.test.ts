import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import pino from 'pino'

import { init } from '../../module'

const silentLogger = pino({ level: 'silent' })

const makeMockRedis = () => {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    // ioredis signature: set(key, value, 'EX', ttlSeconds) — accept and ignore TTL args
    set: async (key: string, value: string, ..._rest: unknown[]) => {
      store.set(key, value)
      return 'OK'
    }
  } as any
}

const buildApp = () => {
  const { router } = init({ redis: makeMockRedis(), logger: silentLogger })
  const app = new Hono()
  app.route('/api/metadata', router)
  return app
}

describe('GET /api/metadata (integration)', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns 400 INVALID_URL for missing query param with ErrorResponse shape', async () => {
    const app = buildApp()
    const response = await app.request('http://localhost/api/metadata')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('INVALID_URL')
    expect(typeof body.message).toBe('string')
  })

  test('returns 400 INVALID_URL for malformed url with ErrorResponse shape', async () => {
    const app = buildApp()
    const response = await app.request('http://localhost/api/metadata?url=not-a-url')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('INVALID_URL')
  })

  test('does not echo provider-controlled oembed.html on the wire', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'video',
          title: 'Test',
          provider_name: 'YouTube',
          html: '<iframe src="https://attacker.example"></iframe>'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=xss')
    )
    const body = await response.json()
    expect(body.oembed?.html).toBeUndefined()
  })

  test('returns 400 BLOCKED_URL for private IP', async () => {
    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('http://192.168.1.1')
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('BLOCKED_URL')
  })

  test('returns 200 with rich payload on oEmbed hit', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'video',
          title: 'Test',
          provider_name: 'YouTube',
          html: '<iframe />'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=abc')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=3600')
    expect(response.headers.get('vary')).toBe('Accept-Language')
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.title).toBe('Test')
    expect(body.publisher.name).toBe('YouTube')
    expect(body.cached).toBe(false)
    expect(body.fetched_at).toBeDefined()
  })

  test('returns 200 with fallback when all stages fail', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }))

    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('https://random-blog.example.com')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=600')
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.title).toBe('random-blog.example.com')
  })

  test('second call serves from L3 cache', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ title: 'Cached', provider_name: 'YouTube' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    const app = buildApp()
    const url =
      'http://localhost/api/metadata?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=cached')

    const first = await app.request(url)
    expect((await first.json()).cached).toBe(false)

    const second = await app.request(url)
    const body = await second.json()
    expect(body.cached).toBe(true)
  })
})
