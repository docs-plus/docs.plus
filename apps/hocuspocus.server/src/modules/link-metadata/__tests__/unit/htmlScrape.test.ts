import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { runHtmlScrape } from '../../domain/stages/htmlScrape'
import type { Scraper } from '../../domain/types'

const noopScraper: Scraper = { scrape: async () => ({ title: 'scraped' }) }

const html = (charset: string, body: string): string =>
  `<!doctype html><html><head><meta charset="${charset}"><title>x</title></head><body>${body}</body></html>`

describe('runHtmlScrape', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('passes Accept-Language and compound User-Agent', async () => {
    fetchSpy.mockResolvedValue(
      new Response(html('utf-8', 'ok'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    await runHtmlScrape('https://example.com', noopScraper, 'fr-FR')

    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('accept-language')).toBe('fr-FR')
    expect(headers.get('user-agent')).toContain('DocsPlusBot')
    expect(headers.get('user-agent')).toContain('facebookexternalhit')
  })

  test('uses Content-Type charset to decode body', async () => {
    const utf16Bytes = new TextEncoder().encode('utf8 body')
    fetchSpy.mockResolvedValue(
      new Response(utf16Bytes, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    let receivedHtml = ''
    const scraper: Scraper = {
      scrape: async ({ html: h }) => {
        receivedHtml = h
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://example.com', scraper, undefined)
    expect(receivedHtml).toContain('utf8 body')
  })

  test('falls back to <meta charset> when Content-Type lacks charset', async () => {
    const body = html('iso-8859-1', 'café')
    const bytes = new Uint8Array(body.length)
    for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff

    fetchSpy.mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'text/html' }
      })
    )

    let receivedHtml = ''
    const scraper: Scraper = {
      scrape: async ({ html: h }) => {
        receivedHtml = h
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://example.com', scraper, undefined)
    expect(receivedHtml).toContain('café')
  })

  test('returns minimal shape when content-type is not HTML', async () => {
    fetchSpy.mockResolvedValue(
      new Response('PDF binary blob', {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      })
    )

    const result = await runHtmlScrape('https://example.com/file.pdf', noopScraper, undefined)
    expect(result?.title).toBe('file.pdf')
    expect(result?.media_type).toBe('document')
  })

  test('uses response.url (post-redirect) as scraper base', async () => {
    const body = new TextEncoder().encode(html('utf-8', 'ok'))
    const fakeResponse = {
      ok: true,
      status: 200,
      url: 'https://final.example.com/x',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      arrayBuffer: async () => body.buffer
    }
    fetchSpy.mockResolvedValue(fakeResponse as unknown as Response)

    let receivedUrl = ''
    const scraper: Scraper = {
      scrape: async ({ url }) => {
        receivedUrl = url
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://short.example.com/redirect', scraper, undefined)
    expect(receivedUrl).toBe('https://final.example.com/x')
  })

  test('returns null on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 503 }))
    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBeNull()
  })

  test('aborts when body exceeds 5MB cap', async () => {
    const big = new Uint8Array(6 * 1024 * 1024)
    fetchSpy.mockResolvedValue(
      new Response(big, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': String(big.byteLength) }
      })
    )
    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBeNull()
  })

  test('aborts mid-stream when body exceeds 5MB cap even with lying content-length', async () => {
    // 6MB streamed body, but content-length lies and says 1 byte.
    const sixMegs = new Uint8Array(6 * 1024 * 1024)
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Hand out the body in 64KB chunks
        const chunk = 64 * 1024
        const start = pulls * chunk
        if (start >= sixMegs.byteLength) {
          controller.close()
          return
        }
        controller.enqueue(sixMegs.subarray(start, start + chunk))
        pulls++
      }
    })

    fetchSpy.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '1' }
      })
    )

    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBeNull()
    // Cap is 5MB, chunks are 64KB. The reader must abort no later than
    // ~81 chunks (5MB/64KB = 80, +1 for the chunk that crosses). If the
    // impl regresses to "buffer everything then check", `pulls` will hit
    // ~96 (the full 6MB worth of chunks). 85 is a comfortable upper bound.
    expect(pulls).toBeLessThan(85)
  })

  test('returns null when scraper produces no title', async () => {
    fetchSpy.mockResolvedValue(
      new Response(html('utf-8', 'ok'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    const noTitleScraper: Scraper = { scrape: async () => ({ description: 'no title here' }) }
    const result = await runHtmlScrape('https://example.com', noTitleScraper, undefined)
    expect(result).toBeNull()
  })
})
