import { describe, expect, test } from 'bun:test'

import { acquireLargeDecode, LARGE_DECODE_BYTES, type LargeDecodeOutcome } from '../largeDecodeGate'

describe('largeDecodeGate (#754)', () => {
  test('bypasses the gate below LARGE_DECODE_BYTES without recording an outcome', async () => {
    const outcomes: LargeDecodeOutcome[] = []
    const holder = await acquireLargeDecode(LARGE_DECODE_BYTES, 0)
    expect(holder).not.toBeNull()
    try {
      const small = await acquireLargeDecode(LARGE_DECODE_BYTES - 1, 0, (o) => outcomes.push(o))
      expect(small).not.toBeNull()
      small?.()
      expect(outcomes).toEqual([])
    } finally {
      holder?.()
    }
  })

  test('grants queued waiters in strict FIFO order and records run/waited outcomes', async () => {
    const order: string[] = []
    const outcomes: LargeDecodeOutcome[] = []

    const r1 = await acquireLargeDecode(LARGE_DECODE_BYTES, 50, (o) => outcomes.push(o))
    expect(r1).not.toBeNull()
    order.push('acquired-1')

    const p2 = acquireLargeDecode(LARGE_DECODE_BYTES, 500, (o) => outcomes.push(o)).then((r) => {
      order.push('acquired-2')
      return r
    })
    const p3 = acquireLargeDecode(LARGE_DECODE_BYTES, 500, (o) => outcomes.push(o)).then((r) => {
      order.push('acquired-3')
      return r
    })

    // Waiters stay queued while r1 holds the slot.
    await Bun.sleep(10)
    expect(order).toEqual(['acquired-1'])

    r1?.()
    const r2 = await p2
    expect(r2).not.toBeNull()
    expect(order).toEqual(['acquired-1', 'acquired-2'])

    r2?.()
    const r3 = await p3
    expect(r3).not.toBeNull()
    expect(order).toEqual(['acquired-1', 'acquired-2', 'acquired-3'])
    r3?.()

    expect(outcomes).toEqual(['run', 'waited', 'waited'])
  })

  test('returns null and records refused after waitMs expires, removing the timed-out waiter', async () => {
    const outcomes: LargeDecodeOutcome[] = []
    const r1 = await acquireLargeDecode(LARGE_DECODE_BYTES, 50, (o) => outcomes.push(o))
    expect(r1).not.toBeNull()
    try {
      const timedOut = await acquireLargeDecode(LARGE_DECODE_BYTES, 25, (o) => outcomes.push(o))
      expect(timedOut).toBeNull()
      expect(outcomes).toEqual(['run', 'refused'])
    } finally {
      r1?.()
    }

    // Slot is free again after the holder releases (timed-out waiter was spliced out).
    const rNext = await acquireLargeDecode(LARGE_DECODE_BYTES, 0)
    expect(rNext).not.toBeNull()
    rNext?.()
  })

  test('release is idempotent and cannot double-hand off the slot to a second waiter', async () => {
    const r1 = await acquireLargeDecode(LARGE_DECODE_BYTES, 50)
    expect(r1).not.toBeNull()

    let thirdAcquired = false
    const p2 = acquireLargeDecode(LARGE_DECODE_BYTES, 500)
    const p3 = acquireLargeDecode(LARGE_DECODE_BYTES, 500).then((r) => {
      thirdAcquired = true
      return r
    })

    // Calling r1 twice must only wake waiter 2, never waiter 3.
    r1?.()
    r1?.()

    const r2 = await p2
    expect(r2).not.toBeNull()
    await Bun.sleep(15)
    expect(thirdAcquired).toBe(false)

    r2?.()
    const r3 = await p3
    expect(r3).not.toBeNull()
    expect(thirdAcquired).toBe(true)
    r3?.()
  })
})
