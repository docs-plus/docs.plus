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
  })
})
