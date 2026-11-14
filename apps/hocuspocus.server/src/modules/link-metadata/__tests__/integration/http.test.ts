import * as dns from 'node:dns/promises'

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import pino from 'pino'

import { createMemoryRedis } from '../../../../../tests/helpers/memory-redis'
import { COLD_WORK_MAX, coldWork, type Release } from '../../domain/admission'
import type { OwnImage } from '../../domain/types'
import { init } from '../../module'

// Wire shape that tests assert against. Kept independent of the production types
// because the discriminated union (success: true vs false) collapses to `never`
// when intersected. `toBe()` narrows expected values from the receiver's type.
// `success: boolean` here is intentional.
interface WireBody {
  success?: boolean
  message?: string
  code?: string
  title?: string
  publisher?: { name?: string }
  cached?: boolean
  fallback?: boolean
  fetched_at?: string
  oembed?: { html?: string }
  miss?: string
}
const readBody = async (response: Response): Promise<WireBody> =>
  (await response.json()) as WireBody

const silentLogger = pino({ level: 'silent' })

const buildApp = (ownImage?: OwnImage) => {
  const { router } = init({ redis: createMemoryRedis(), logger: silentLogger, ownImage })
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
    const body = await readBody(response)
    expect(body.success).toBe(false)
    expect(body.code).toBe('INVALID_URL')
    expect(typeof body.message).toBe('string')
  })

  test('returns 400 INVALID_URL for malformed url with ErrorResponse shape', async () => {
    const app = buildApp()
    const response = await app.request('http://localhost/api/metadata?url=not-a-url')
    expect(response.status).toBe(400)
    const body = await readBody(response)
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
    const body = (await response.json()) as { oembed?: { html?: string } }
    expect(body.oembed?.html).toBeUndefined()
  })

  test('returns 400 BLOCKED_URL for private IP', async () => {
    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('http://192.168.1.1')
    )
    expect(response.status).toBe(400)
    const body = await readBody(response)
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
    const body = await readBody(response)
    expect(body.success).toBe(true)
    expect(body.title).toBe('Test')
    expect(body.publisher?.name).toBe('YouTube')
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
    const body = await readBody(response)
    expect(body.success).toBe(true)
    expect(body.title).toBe('random-blog.example.com')
    expect(body.fallback).toBe(true)

    // Before #242 a cache hit on a fallback card got the one-hour positive header.
    const again = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('https://random-blog.example.com')
    )
    const cachedBody = await readBody(again)
    expect(cachedBody.cached).toBe(true)
    expect(cachedBody.fallback).toBe(true)
    expect(again.headers.get('cache-control')).toBe('public, max-age=600')
  })

  test('second call serves from the cache stage', async () => {
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
    expect((await readBody(first)).cached).toBe(false)

    const second = await app.request(url)
    const body = await readBody(second)
    expect(body.cached).toBe(true)
  })
})

// The schema passes example.com on its string check, so only safeFetch's DNS
// check can refuse this. A removed check would fetch and serve the PNG below.
describe('GET /api/metadata/icon DNS refusal (integration)', () => {
  let fetchSpy: ReturnType<typeof spyOn>
  let dnsSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    const png = new Uint8Array(32)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })) as never
    )
    dnsSpy = spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    dnsSpy.mockRestore()
  })

  test('answers 204 without a fetch when the origin resolves to a private address', async () => {
    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata/icon?origin=' + encodeURIComponent('https://example.com')
    )
    expect(response.status).toBe(204)
    // Only the controller's catch sends this header; a route miss sends none.
    expect(response.headers.get('cache-control')).toBe('public, max-age=600')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// Routes each mocked fetch by URL. An unknown URL is a 404, so a test sees every hop it did not plan.
type Route = (init: RequestInit) => Response | Promise<Response>
const pngBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes
}
const html = (head: string): Response =>
  new Response(`<!doctype html><html><head>${head}</head><body></body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
const notFound = (): Response => new Response(null, { status: 404 })
// Settles only when the route's signal aborts, like a peer that never answers.
const hangUntilAbort = (init: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })

describe('routed fetch (integration)', () => {
  let fetchSpy: ReturnType<typeof spyOn>
  let dnsSpy: ReturnType<typeof spyOn>
  let routes: Record<string, Route>

  const fetchedUrls = (): string[] => fetchSpy.mock.calls.map((call: unknown[]) => String(call[0]))

  beforeEach(() => {
    routes = {}
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input: string,
      init: RequestInit
    ) => (routes[String(input)] ?? notFound)(init)) as never)
    dnsSpy = spyOn(dns, 'lookup').mockImplementation((async (host: string) =>
      host === 'intranet.example.com'
        ? [{ address: '10.0.0.5', family: 4 }]
        : [{ address: '93.184.216.34', family: 4 }]) as never)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    dnsSpy.mockRestore()
  })

  describe('GET /api/metadata/icon', () => {
    const requestIcon = (origin: string) =>
      buildApp().request('http://localhost/api/metadata/icon?origin=' + encodeURIComponent(origin))

    // An agent-written link can hide data in a host label. No fetch and no DNS lookup may name it.
    test('fetches only the registrable domain, never the requested host', async () => {
      routes['https://attacker.example/favicon.ico'] = () => new Response(pngBytes(64))

      const response = await requestIcon('https://c2vjcmv0.attacker.example')
      expect(response.status).toBe(200)
      expect(fetchedUrls()).toEqual(['https://attacker.example/favicon.ico'])
      const lookups = dnsSpy.mock.calls.map((call: unknown[]) => String(call[0]))
      expect(lookups.some((host: string) => host.includes('c2vjcmv0'))).toBe(false)
    })

    test('a miss is an empty 204 with the clean-miss cache header', async () => {
      const response = await requestIcon('https://example.com')
      expect(response.status).toBe(204)
      expect(await response.text()).toBe('')
      expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
    })

    // LinkedIn's favicon.ico was 24,838 B and missed under the old 16 KiB default.
    test('the default cap serves a 24,838 B favicon and refuses 32,769 B', async () => {
      routes['https://example.com/favicon.ico'] = () => new Response(pngBytes(24_838))
      const hit = await requestIcon('https://example.com')
      expect(hit.status).toBe(200)
      expect((await hit.arrayBuffer()).byteLength).toBe(24_838)

      routes['https://example.com/favicon.ico'] = () => new Response(pngBytes(32_769))
      expect((await requestIcon('https://example.com')).status).toBe(204)
    })

    test('falls back to a PNG link icon in the page head when /favicon.ico is 404', async () => {
      routes['https://example.com/'] = () =>
        html(
          '<link rel="mask-icon" href="/mask.svg"><link rel="apple-touch-icon" href="/touch.png">' +
            '<link rel="icon" type="image/png" sizes="32x32" href="https://cdn.example.net/i.png?v=1&amp;s=32">'
        )
      routes['https://cdn.example.net/i.png?v=1&s=32'] = () => new Response(pngBytes(64))

      const response = await requestIcon('https://example.com')
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toBe('public, max-age=604800')
    })

    test.each([
      ['a private IP', 'http://10.0.0.5/i.png'],
      ['a host that resolves to a private address', 'https://intranet.example.com/i.png']
    ])('refuses an icon href that points to %s', async (_name, href) => {
      routes['https://example.com/'] = () => html(`<link rel="icon" href="${href}">`)
      routes[href] = () => new Response(pngBytes(64))

      const response = await requestIcon('https://example.com')
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toBe('public, max-age=600')
      expect(fetchedUrls()).not.toContain(href)
    })

    test('never fetches an SVG link icon', async () => {
      routes['https://example.com/'] = () =>
        html('<link rel="icon" type="image/svg+xml" href="/a"><link rel="icon" href="/b.svg">')

      const response = await requestIcon('https://example.com')
      expect(response.status).toBe(204)
      expect(fetchedUrls()).toEqual(['https://example.com/favicon.ico', 'https://example.com/'])
    })

    test('one 3 s timer bounds the whole chain', async () => {
      // A slow favicon miss, then a page that never answers: a timer per hop would run past 5 s.
      routes['https://example.com/favicon.ico'] = (init) =>
        Promise.race([
          new Promise<Response>((resolve) => setTimeout(() => resolve(notFound()), 2000)),
          hangUntilAbort(init)
        ])
      routes['https://example.com/'] = hangUntilAbort

      const started = performance.now()
      const response = await requestIcon('https://example.com')
      expect(performance.now() - started).toBeLessThan(3500)
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toBe('public, max-age=600')
    }, 6000)
  })

  describe('GET /api/metadata/image', () => {
    const requestImage = (page: string) =>
      buildApp().request('http://localhost/api/metadata/image?url=' + encodeURIComponent(page))
    const pageWithImage = (src: string) => () =>
      html(`<title>Page</title><meta property="og:image" content="${src}">`)

    test('serves the page image, typed from its bytes', async () => {
      routes['https://example.com/post'] = pageWithImage('https://cdn.example.net/card.png')
      routes['https://cdn.example.net/card.png'] = () =>
        new Response(pngBytes(2048), { headers: { 'content-type': 'text/html' } })

      const response = await requestImage('https://example.com/post')
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
      expect((await response.arrayBuffer()).byteLength).toBe(2048)
    })

    // #786: a declared length streams the image through, and a body that breaks it fails.
    describe('with a declared length', () => {
      const sized =
        (bytes: Uint8Array, length = bytes.byteLength) =>
        () =>
          new Response(bytes, { headers: { 'content-length': String(length) } })
      beforeEach(() => {
        routes['https://example.com/post'] = pageWithImage('https://cdn.example.net/card.png')
      })

      test('streams the image through', async () => {
        routes['https://cdn.example.net/card.png'] = sized(pngBytes(70_000))
        const response = await requestImage('https://example.com/post')
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/png')
        expect((await response.arrayBuffer()).byteLength).toBe(70_000)
      })

      test('fails the body when the upstream sends less than it declared', async () => {
        routes['https://cdn.example.net/card.png'] = sized(pngBytes(1024), 4096)
        const response = await requestImage('https://example.com/post')
        expect(response.status).toBe(200)
        // A regression here hangs the read, so race it against a timer to fail fast.
        const stalled = Bun.sleep(1000).then(() => {
          throw new Error('the body read hung')
        })
        await expect(Promise.race([response.arrayBuffer(), stalled])).rejects.toThrow(
          'sent 1024 of 4096'
        )
      })

      test('fails the body when the upstream sends more than it declared', async () => {
        const head = pngBytes(16)
        routes['https://cdn.example.net/card.png'] = () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(head)
                controller.enqueue(new Uint8Array(32))
                controller.close()
              }
            }),
            { headers: { 'content-length': '32' } }
          )
        const response = await requestImage('https://example.com/post')
        expect(response.status).toBe(200)
        await expect(response.arrayBuffer()).rejects.toThrow('sent 48 of 32')
      })

      test('answers 204 for a length over 2 MiB', async () => {
        routes['https://cdn.example.net/card.png'] = sized(pngBytes(1024), 2 * 1024 * 1024 + 1)
        expect((await requestImage('https://example.com/post')).status).toBe(204)
      })

      test('answers 204 for a length under the sniff floor', async () => {
        routes['https://cdn.example.net/card.png'] = sized(pngBytes(15))
        expect((await requestImage('https://example.com/post')).status).toBe(204)
      })

      // Fetch unzips the body but keeps the coded length, so a coded image must be buffered.
      test('buffers a coded body instead of trusting its length', async () => {
        routes['https://cdn.example.net/card.png'] = () =>
          new Response(pngBytes(70_000), {
            headers: { 'content-length': '144', 'content-encoding': 'gzip' }
          })
        const response = await requestImage('https://example.com/post')
        expect(response.status).toBe(200)
        expect((await response.arrayBuffer()).byteLength).toBe(70_000)
      })
    })

    test('answers a no-store 204 when 32 images with no declared length are reading', async () => {
      routes['https://example.com/post'] = pageWithImage('https://cdn.example.net/card.png')
      const open: ReadableStreamDefaultController<Uint8Array>[] = []
      routes['https://cdn.example.net/card.png'] = () =>
        new Response(new ReadableStream({ start: (controller) => void open.push(controller) }))
      const reading = Array.from({ length: 32 }, () => requestImage('https://example.com/post'))
      while (open.length < 32) await Bun.sleep(5)

      const busy = await requestImage('https://example.com/post')
      expect(busy.status).toBe(204)
      expect(busy.headers.get('cache-control')).toBe('no-store')

      for (const controller of open) {
        controller.enqueue(pngBytes(32))
        controller.close()
      }
      expect((await Promise.all(reading)).map((r) => r.status)).toEqual(Array(32).fill(200))
    })

    test('refuses a page image on a private address', async () => {
      routes['https://example.com/post'] = pageWithImage('https://intranet.example.com/card.png')
      routes['https://intranet.example.com/card.png'] = () => new Response(pngBytes(2048))

      const response = await requestImage('https://example.com/post')
      expect(response.status).toBe(204)
      expect(fetchedUrls()).not.toContain('https://intranet.example.com/card.png')
    })

    test('reads our own card in process, and follows its 302 over the network', async () => {
      const card = 'https://api.docs.plus/api/documents/a/card.png?v=1'
      const shed = 'https://api.docs.plus/api/documents/b/card.png?v=1'
      const fallback = 'https://docs.plus/icons/og-card.png'
      const ownImage: OwnImage = (url) =>
        url === card
          ? Promise.resolve(new Response(pngBytes(1024)))
          : url === shed
            ? Promise.resolve(new Response(null, { status: 302, headers: { location: fallback } }))
            : null
      routes['https://docs.plus/a'] = pageWithImage(card)
      routes['https://docs.plus/b'] = pageWithImage(shed)
      routes[fallback] = () => new Response(pngBytes(512))
      const app = buildApp(ownImage)
      const read = (page: string) =>
        app.request('http://localhost/api/metadata/image?url=' + encodeURIComponent(page))

      expect((await (await read('https://docs.plus/a')).arrayBuffer()).byteLength).toBe(1024)
      expect((await (await read('https://docs.plus/b')).arrayBuffer()).byteLength).toBe(512)
      expect(fetchedUrls()).not.toContain(card)
      expect(fetchedUrls()).not.toContain(shed)
    })

    test('no page image, or an SVG one, is an empty 204', async () => {
      routes['https://example.com/plain'] = () => html('<title>Plain</title>')
      expect((await requestImage('https://example.com/plain')).status).toBe(204)

      routes['https://example.com/svg'] = pageWithImage('https://cdn.example.net/card.svg')
      routes['https://cdn.example.net/card.svg'] = () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')
      const response = await requestImage('https://example.com/svg')
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toBe('public, max-age=600')
    })
  })

  describe('GET /api/metadata/archive', () => {
    const page = 'https://example.com/post'
    const lookup = (url: string) =>
      'https://archive.org/wayback/available?url=' + encodeURIComponent(url)
    const closest = (snapshot: Record<string, unknown>) => () =>
      Response.json({ url: page, archived_snapshots: { closest: snapshot } })
    // One app per test, so a second request can hit the first one's cache.
    const archiveApp = () => {
      const { router } = init({
        redis: createMemoryRedis(),
        logger: silentLogger,
        padSlugOf: (url) => (new URL(url).hostname === 'docs.plus' ? 'pad' : null)
      })
      const app = new Hono().route('/api/metadata', router)
      return (url: string) =>
        app.request('http://localhost/api/metadata/archive?url=' + encodeURIComponent(url))
    }
    interface ArchiveBody {
      url?: string
      snapshot?: { url: string; timestamp: string } | null
      miss?: string
      code?: string
    }
    const readArchive = async (response: Response) => (await response.json()) as ArchiveBody

    test('answers the https snapshot, asks only the availability API, and caches the hit', async () => {
      routes[lookup(page)] = closest({
        status: '200',
        available: true,
        url: 'http://web.archive.org/web/20130919044612/http://example.com/post',
        timestamp: '20130919044612'
      })
      const request = archiveApp()

      // Tracking params and the fragment never reach archive.org.
      const first = await request(`${page}?utm_source=x#top`)
      expect(first.status).toBe(200)
      expect(first.headers.get('cache-control')).toBe('public, max-age=3600')
      expect(await readArchive(first)).toEqual({
        success: true,
        url: page,
        snapshot: {
          url: 'https://web.archive.org/web/20130919044612/http://example.com/post',
          timestamp: '2013-09-19T04:46:12.000Z'
        }
      } as ArchiveBody)

      const second = await request(page)
      expect((await readArchive(second)).snapshot?.url).toStartWith('https://web.archive.org/web/')
      expect(fetchedUrls()).toEqual([lookup(page)])
    })

    test.each([
      ['a look-alike host', 'http://web.archive.org.evil.example/web/2020/x'],
      ['credentials before the host', 'https://web.archive.org@evil.example/web/2020/x'],
      ['a Save Page Now path', 'https://web.archive.org/save/https://example.com/post'],
      ['a non-web scheme', 'javascript://web.archive.org/web/2020/x']
    ])('refuses a snapshot URL with %s', async (_name, url) => {
      routes[lookup(page)] = closest({ available: true, url, timestamp: '20200101000000' })
      const response = await archiveApp()(page)
      expect(await readArchive(response)).toMatchObject({ snapshot: null, miss: 'none' })
    })

    test('no snapshot is a clean miss, cached for ten minutes', async () => {
      routes[lookup(page)] = () => Response.json({ url: page, archived_snapshots: {} })
      const request = archiveApp()

      const response = await request(page)
      expect(response.headers.get('cache-control')).toBe('public, max-age=600')
      expect(await readArchive(response)).toMatchObject({ snapshot: null, miss: 'none' })
      await request(page)
      expect(fetchedUrls()).toHaveLength(1)
    })

    test('an archive 5xx is unreachable and never cached', async () => {
      routes[lookup(page)] = () => new Response('busy', { status: 503 })
      const request = archiveApp()

      const response = await request(page)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await readArchive(response)).toMatchObject({ snapshot: null, miss: 'unreachable' })
      await request(page)
      expect(fetchedUrls()).toHaveLength(2)
    })

    test('one 4 s timer bounds the lookup', async () => {
      routes[lookup(page)] = hangUntilAbort
      const started = performance.now()
      const response = await archiveApp()(page)
      expect(performance.now() - started).toBeLessThan(4500)
      expect(await readArchive(response)).toMatchObject({ miss: 'unreachable' })
    }, 6000)

    test('refuses a private address and a malformed URL with no fetch', async () => {
      const request = archiveApp()
      const blocked = await request('http://192.168.1.1/admin')
      expect(blocked.status).toBe(400)
      expect((await readArchive(blocked)).code).toBe('BLOCKED_URL')

      const invalid = await request('not-a-url')
      expect(invalid.status).toBe(400)
      expect((await readArchive(invalid)).code).toBe('INVALID_URL')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    // A Private pad's slug must never leave this server.
    test('never sends a docs.plus pad URL to archive.org', async () => {
      const response = await archiveApp()('https://docs.plus/secret-pad')
      expect(await readArchive(response)).toMatchObject({ snapshot: null, miss: 'none' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  // #787: cold work past the cap is shed at once, with no-store and no cache write.
  describe('cold-work admission', () => {
    const page = 'https://example.com/post'
    let held: Release[] = []
    const fillCap = () => {
      while (coldWork.inFlight() < COLD_WORK_MAX) held.push(coldWork.tryAcquire() as Release)
    }
    const freeCap = () => {
      for (const release of held) release()
      held = []
    }
    afterEach(() => {
      freeCap()
      // A leaked slot would make later tests shed at random.
      expect(coldWork.inFlight()).toBe(0)
    })

    test('a shed metadata miss is a no-store fallback card that caches nothing', async () => {
      routes[page] = () => html('<title>Real title</title>')
      const app = buildApp()
      const request = () =>
        app.request('http://localhost/api/metadata?url=' + encodeURIComponent(page))

      fillCap()
      const shed = await request()
      expect(shed.status).toBe(200)
      expect(shed.headers.get('cache-control')).toBe('no-store')
      expect(await readBody(shed)).toMatchObject({
        fallback: true,
        miss: 'unreachable',
        cached: false
      })
      expect(fetchedUrls()).toEqual([])

      freeCap()
      const next = await request()
      expect(await readBody(next)).toMatchObject({ title: 'Real title', cached: false })
    })

    test('a cache hit is served while the cap is full', async () => {
      routes[page] = () => html('<title>Real title</title>')
      const app = buildApp()
      const request = () =>
        app.request('http://localhost/api/metadata?url=' + encodeURIComponent(page))
      await request()

      fillCap()
      const hit = await request()
      expect(await readBody(hit)).toMatchObject({ title: 'Real title', cached: true })
    })

    test('the image route sheds the page read and the relay with a no-store 204', async () => {
      routes[page] = () =>
        html(
          `<title>Page</title><meta property="og:image" content="https://cdn.example.net/card.png">`
        )
      routes['https://cdn.example.net/card.png'] = () => new Response(pngBytes(2048))
      const app = buildApp()
      const request = () =>
        app.request('http://localhost/api/metadata/image?url=' + encodeURIComponent(page))

      fillCap()
      const pageShed = await request()
      expect(pageShed.status).toBe(204)
      expect(pageShed.headers.get('cache-control')).toBe('no-store')

      // With the page card cached, only the relay needs a slot.
      freeCap()
      expect((await request()).status).toBe(200)
      fillCap()
      const relayShed = await request()
      expect(relayShed.status).toBe(204)
      expect(relayShed.headers.get('cache-control')).toBe('no-store')
      expect(fetchedUrls().filter((url) => url.includes('cdn.example.net'))).toHaveLength(1)
    })

    // #786 bounds a stream's memory, so a stream holds no slot. One slot per stream capped images near 25.6/s.
    test('more than 64 held-open image streams are all served', async () => {
      routes[page] = () =>
        html(
          `<title>Page</title><meta property="og:image" content="https://cdn.example.net/card.png">`
        )
      routes['https://cdn.example.net/card.png'] = () =>
        new Response(
          new ReadableStream({ start: (controller) => controller.enqueue(pngBytes(16)) }),
          {
            headers: { 'content-length': '4096' }
          }
        )
      const app = buildApp()
      const open: Response[] = []
      // One at a time, so each sniff ends before the next fetch, and only open streams pile up.
      for (let i = 0; i < COLD_WORK_MAX + 6; i += 1) {
        open.push(
          await app.request('http://localhost/api/metadata/image?url=' + encodeURIComponent(page))
        )
      }
      expect(open.map((response) => response.status)).toEqual(Array(COLD_WORK_MAX + 6).fill(200))
      expect(coldWork.inFlight()).toBe(0)
      await Promise.all(open.map((response) => response.body?.cancel()))
    })

    test('a shed icon fetch is a no-store 204 with no fetch', async () => {
      fillCap()
      const response = await buildApp().request(
        'http://localhost/api/metadata/icon?origin=' + encodeURIComponent('https://example.com')
      )
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('a shed archive lookup answers unreachable and caches nothing', async () => {
      const lookup = 'https://archive.org/wayback/available?url=' + encodeURIComponent(page)
      routes[lookup] = () => Response.json({ url: page, archived_snapshots: {} })
      const app = buildApp()
      const request = () =>
        app.request('http://localhost/api/metadata/archive?url=' + encodeURIComponent(page))

      fillCap()
      const shed = await request()
      expect(shed.headers.get('cache-control')).toBe('no-store')
      expect(await shed.json()).toMatchObject({ snapshot: null, miss: 'unreachable' })
      expect(fetchSpy).not.toHaveBeenCalled()

      freeCap()
      expect(await (await request()).json()).toMatchObject({ snapshot: null, miss: 'none' })
      expect(fetchedUrls()).toEqual([lookup])
    })
  })
})
