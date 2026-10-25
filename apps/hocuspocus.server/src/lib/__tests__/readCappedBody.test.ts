import { describe, expect, test } from 'bun:test'

import { readCappedBody } from '../readCappedBody'

const CAP = 64

describe('readCappedBody', () => {
  test('a body of exactly cap bytes is read whole', async () => {
    const controller = new AbortController()
    const buf = await readCappedBody(new Response(new Uint8Array(CAP)), controller, CAP)
    expect(buf?.byteLength).toBe(CAP)
    expect(controller.signal.aborted).toBe(false)
  })

  test('one byte over the cap returns null and aborts the transfer', async () => {
    const controller = new AbortController()
    const buf = await readCappedBody(new Response(new Uint8Array(CAP + 1)), controller, CAP)
    expect(buf).toBeNull()
    expect(controller.signal.aborted).toBe(true)
  })
})
