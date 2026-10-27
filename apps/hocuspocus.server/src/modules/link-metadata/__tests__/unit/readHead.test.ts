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
  test('stops after the chunk that holds </head, even when the tag spans two chunks', async () => {
    const head = await read(
      streamOf('<head><link rel=icon href=/a.png></HE', 'AD><body>', '<link rel=icon href=/b.png>'),
      1024
    )
    expect(head).toBe('<head><link rel=icon href=/a.png></HEAD><body>')
  })

  test('keeps the first cap bytes of a head with no end', async () => {
    expect(await read(streamOf('a'.repeat(10), 'b'.repeat(10)), 15)).toBe(
      'a'.repeat(10) + 'b'.repeat(5)
    )
  })
})
