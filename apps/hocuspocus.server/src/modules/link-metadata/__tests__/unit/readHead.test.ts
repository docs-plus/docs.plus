import { describe, expect, test } from 'bun:test'

import { readHead } from '../../domain/readHead'

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
  test('cuts at </head, even when the tag spans two chunks', async () => {
    const head = await read(
      streamOf('<head><link rel=icon href=/a.png></HE', 'AD><body>', '<link rel=icon href=/b.png>'),
      1024
    )
    expect(head).toBe('<head><link rel=icon href=/a.png>')
  })

  test('gives the same bytes however the network splits the page', async () => {
    // The card is cached for 24 h, so one page must never give two cards.
    const page = '<head><title>T</title></head><body><h1 class="title">B</h1></body>'
    const whole = await read(streamOf(page), 1024)
    const split = await read(streamOf(page.slice(0, 30), page.slice(30)), 1024)
    expect(split).toBe(whole)
    expect(whole).toBe('<head><title>T</title>')
  })

  test('keeps the first cap bytes of a head with no end', async () => {
    expect(await read(streamOf('a'.repeat(10), 'b'.repeat(10)), 15)).toBe(
      'a'.repeat(10) + 'b'.repeat(5)
    )
  })
})
