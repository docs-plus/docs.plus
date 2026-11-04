import * as dns from 'node:dns/promises'

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { runHtmlScrape } from '../../domain/stages/htmlScrape'
import type { Scraper } from '../../domain/types'
import { createHeadScraper } from '../../infra/headScraper'

const noopScraper: Scraper = {
  scrape: async () => ({ title: 'scraped' }),
  jobFacts: () => undefined
}

const html = (charset: string, title: string): string =>
  `<!doctype html><html><head><meta charset="${charset}"><title>${title}</title></head><body></body></html>`

describe('runHtmlScrape', () => {
  let fetchSpy: ReturnType<typeof spyOn>
  let dnsSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
    // safeFetch resolves the host before it fetches. A live lookup made CI wait on
    // a slow resolver until the stage timeout, so answer with a public address.
    dnsSpy = spyOn(dns, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 }
    ] as never)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    dnsSpy.mockRestore()
  })

  describe('JSON-LD tail', () => {
    const posting = (fields: object) =>
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', ...fields })}</script>`
    // Lever's shape on 2026-11-03: no JSON-LD in the head, the posting 8 KB into the body.
    const leverLike = `<html><head><title>Job</title></head><body>${'<p>x</p>'.repeat(1000)}${posting({ employmentType: 'FULL_TIME' })}</body></html>`
    const page = (body: string) =>
      new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    const recording = () => {
      const bodies: string[] = []
      const real = createHeadScraper()
      const scraper: Scraper = {
        scrape: real.scrape,
        jobFacts: (body) => {
          bodies.push(body)
          return real.jobFacts(body)
        }
      }
      return { bodies, scraper }
    }

    test('reads the body for a job URL whose head has no posting', async () => {
      fetchSpy.mockResolvedValue(page(leverLike))
      const { bodies, scraper } = recording()
      const card = await runHtmlScrape('https://jobs.lever.co/acme/1234', scraper, 'en')
      expect(typeof card === 'object' && card.facts).toEqual([{ icon: 'work', text: 'Full-time' }])
      expect(bodies[0]).toContain('JobPosting')
    })

    test('never reads the body for a URL that does not look like a job page', async () => {
      fetchSpy.mockResolvedValue(page(leverLike))
      const { bodies, scraper } = recording()
      const card = await runHtmlScrape('https://example.com/blog/post', scraper, 'en')
      expect(typeof card === 'object' && card.facts).toBeUndefined()
      expect(bodies).toEqual([])
    })

    test('never reads the body when the head already holds the posting', async () => {
      fetchSpy.mockResolvedValue(
        page(
          `<html><head><title>Job</title>${posting({ employmentType: 'INTERN' })}</head><body></body></html>`
        )
      )
      const { bodies, scraper } = recording()
      const card = await runHtmlScrape('https://example.com/careers/42', scraper, 'en')
      expect(typeof card === 'object' && card.facts).toEqual([{ icon: 'work', text: 'Internship' }])
      expect(bodies).toEqual([])
    })
  })

  test('sends the cache-key language subtag and the honest User-Agent', async () => {
    fetchSpy.mockResolvedValue(
      new Response(html('utf-8', 'ok'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    // The cache key reads `en` here, so a Farsi page must not come back under it.
    await runHtmlScrape('https://example.com', noopScraper, 'en;q=0.1, fa')

    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('accept-language')).toBe('en')
    expect(headers.get('user-agent')).toContain('DocsplusBot')
    expect(headers.get('user-agent')).not.toContain('facebookexternalhit')
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
      jobFacts: () => undefined,
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
      jobFacts: () => undefined,
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
    expect(result).toMatchObject({ title: 'file.pdf', media_type: 'document' })
  })

  test.each([
    ['https://example.com/files/Q3%20Report.pdf', 'Q3 Report.pdf'],
    ['https://example.com/files/r%C3%A9sum%C3%A9.docx', 'résumé.docx'],
    ['https://example.com/files/100%25.pdf', '100%.pdf'],
    ['https://example.com/files/bad%E0%A4%A.pdf', 'bad%E0%A4%A.pdf']
  ])('decodes the file name of %s', async (url, title) => {
    fetchSpy.mockResolvedValue(
      new Response('PDF binary blob', {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      })
    )

    const result = await runHtmlScrape(url, noopScraper, undefined)
    expect(result).toMatchObject({ title, media_type: 'document' })
  })

  test('uses response.url (post-redirect) as scraper base', async () => {
    const body = new TextEncoder().encode(html('utf-8', 'ok'))
    const fakeResponse = {
      ok: true,
      status: 200,
      url: 'https://final.example.com/x',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      // readPage reads the stream, so the stub needs a real one.
      body: new Response(body).body
    }
    fetchSpy.mockResolvedValue(fakeResponse as unknown as Response)

    let receivedUrl = ''
    const scraper: Scraper = {
      jobFacts: () => undefined,
      scrape: async ({ url }) => {
        receivedUrl = url
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://example.com/redirect', scraper, undefined)
    expect(receivedUrl).toBe('https://final.example.com/x')
  })

  test('returns the status class on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 503 }))
    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBe('status:5xx')
  })

  test('cuts a chunk that crosses the 1 MiB cap', async () => {
    const big = new Uint8Array(6 * 1024 * 1024)
    fetchSpy.mockResolvedValue(
      new Response(big, { status: 200, headers: { 'content-type': 'text/html' } })
    )
    let receivedLength = 0
    const scraper: Scraper = {
      jobFacts: () => undefined,
      scrape: async ({ html: h }) => {
        receivedLength = h.length
        return { title: 'scraped' }
      }
    }
    const result = await runHtmlScrape('https://example.com', scraper, undefined)
    expect(result).toMatchObject({ title: 'scraped' })
    expect(receivedLength).toBe(1024 * 1024)
  })

  test('cuts at a mixed-case </head> split across chunks', async () => {
    const encoder = new TextEncoder()
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        if (pulls === 1) controller.enqueue(encoder.encode('<html><head><title>x</title></He'))
        else if (pulls === 2) controller.enqueue(encoder.encode('Ad><body>'))
        else controller.enqueue(new Uint8Array(64 * 1024))
      }
    })
    fetchSpy.mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } })
    )

    let receivedHtml = ''
    const scraper: Scraper = {
      jobFacts: () => undefined,
      scrape: async ({ html: h }) => {
        receivedHtml = h
        return { title: 'x' }
      }
    }
    await runHtmlScrape('https://example.com', scraper, undefined)
    expect(receivedHtml).toBe('<html><head><title>x</title>')
  })

  test('stops pulling the stream at the 1 MiB cap', async () => {
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
      new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } })
    )

    let receivedLength = 0
    const scraper: Scraper = {
      jobFacts: () => undefined,
      scrape: async ({ html: h }) => {
        receivedLength = h.length
        return { title: 'scraped' }
      }
    }
    const result = await runHtmlScrape('https://example.com', scraper, undefined)
    expect(result).toMatchObject({ title: 'scraped' })
    expect(receivedLength).toBe(1024 * 1024)
    // The cap is 16 chunks of 64 KB. Reading all 6 MB would pull about 96.
    expect(pulls).toBeLessThan(20)
  })

  test('returns no-title when scraper produces no title', async () => {
    fetchSpy.mockResolvedValue(
      new Response(html('utf-8', 'ok'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    const noTitleScraper: Scraper = {
      scrape: async () => ({ description: 'no title here' }),
      jobFacts: () => undefined
    }
    const result = await runHtmlScrape('https://example.com', noTitleScraper, undefined)
    expect(result).toBe('no-title')
  })
})
