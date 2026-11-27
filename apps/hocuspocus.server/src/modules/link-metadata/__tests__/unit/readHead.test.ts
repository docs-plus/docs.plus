import { describe, expect, test } from 'bun:test'

import { readHead, readPage } from '../../domain/readHead'

const streamOf = (...chunks: string[]): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      }
    })
  )

const read = async (response: Response, cap: number): Promise<string> =>
  new TextDecoder().decode(await readHead(response, new AbortController(), cap))

describe('readHead', () => {
  test('keeps the first cap bytes of a head with no end', async () => {
    expect(await read(streamOf('a'.repeat(10), 'b'.repeat(10)), 15)).toBe(
      'a'.repeat(10) + 'b'.repeat(5)
    )
  })

  describe('readPage', () => {
    const TAIL = { bytes: 64, ms: 1000 }
    const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
    const page = async (response: Response, cap = 1024, tail = TAIL) => {
      const { head, readTail } = await readPage(response, new AbortController(), cap)
      return { head: text(head), tail: text((await readTail(tail)).bytes) }
    }

    // The card is cached for 24 h, so one page must never give two cards.
    test.each([
      [
        '</head>',
        '<head><title>T</title></HEAD><body><script type="application/ld+json">{}</script>'
      ],
      [
        '<body with no </head>',
        '<head><title>T</title><BODY><script type="application/ld+json">{}</script>'
      ]
    ])('splits at %s the same way however the network splits the page', async (_, html) => {
      const whole = await page(streamOf(html))
      for (let at = 1; at < html.length; at += 1) {
        expect(await page(streamOf(html.slice(0, at), html.slice(at)))).toEqual(whole)
      }
      expect(whole).toEqual({ head: '<head><title>T</title>', tail: html.slice(22) })
    })

    // A head end can cross several chunks shorter than itself.
    test('finds a head end split over many short chunks', async () => {
      const html = '<head><title>T</title></hEaD><body>'
      for (let size = 1; size <= 7; size += 1) {
        const chunks = Array.from({ length: Math.ceil(html.length / size) }, (_, i) =>
          html.slice(i * size, (i + 1) * size)
        )
        expect((await page(streamOf(...chunks))).head).toBe('<head><title>T</title>')
      }
    })

    // Each `<` gets a two-byte test first, and gaps under 16 bytes are scanned in place.
    test('cuts at the true head end past near misses and the scan edge', async () => {
      const cut = async (head: string) => (await page(streamOf(`${head}</HEAD><body>`))).head
      for (const head of ['<head><<<', '<head></h1></hea']) expect(await cut(head)).toBe(head)
      for (let gap = 0; gap <= 20; gap += 1) {
        const head = `<head><${'x'.repeat(gap)}y/head>`
        expect(await cut(head)).toBe(head)
      }
    })

    test('reads at most tail.bytes past </head, and never past the cap', async () => {
      const body = 'b'.repeat(500)
      expect((await page(streamOf('<head></head>', body))).tail).toHaveLength(64)
      expect((await page(streamOf('<head></head>', body), 20)).tail).toBe('</head>bbbbbbb')
    })

    test('a tail that runs late is cut and the head is kept', async () => {
      const hop = new AbortController()
      const stalled = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<head><title>T</title></head><body>'))
            hop.signal.addEventListener('abort', () => controller.error(new Error('aborted')))
          }
        })
      )
      const { head, readTail } = await readPage(stalled, hop, 1024)
      expect(text(head)).toBe('<head><title>T</title>')
      const tail = await readTail({ bytes: 1024, ms: 20 })
      expect(text(tail.bytes)).toBe('</head><body>')
      // Cut, so the html stage gives a card with no facts the short TTL.
      expect(tail.cut).toBe(true)
    })

    test('does not pin an oversized backing buffer when an incoming tail chunk exceeds limit', async () => {
      const oversizedChunk = 'x'.repeat(64 * 1024)
      const { readTail } = await readPage(
        streamOf('<head></head>', oversizedChunk),
        new AbortController(),
        1024 * 1024
      )
      const tail = await readTail({ bytes: 64, ms: 1000 })
      expect(tail.cut).toBe(false)
      expect(tail.bytes.byteLength).toBe(64)
      expect(tail.bytes.buffer.byteLength).toBe(64)
      expect(text(tail.bytes)).toBe(`</head>${'x'.repeat(64 - 7)}`)
    })

    test('returns immediately without reading further or arming timer when initial remainder fills limit', async () => {
      const hop = new AbortController()
      const stalledAfterFirst = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`<head></head>${'b'.repeat(100)}`))
          }
        })
      )
      const { head, readTail } = await readPage(stalledAfterFirst, hop, 1024)
      expect(text(head)).toBe('<head>')
      const tail = await readTail({ bytes: 64, ms: 10 })
      expect(tail.cut).toBe(false)
      expect(tail.bytes.byteLength).toBe(64)
      expect(text(tail.bytes)).toBe(`</head>${'b'.repeat(64 - 7)}`)
      expect(hop.signal.aborted).toBe(false)
    })
  })
})
