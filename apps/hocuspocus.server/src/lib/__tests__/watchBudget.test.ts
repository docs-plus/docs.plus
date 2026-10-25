import { describe, expect, test } from 'bun:test'

import { admitWatchBytes, WATCH_MAX_BYTES, WATCH_WINDOW_MS, watchOverBudget } from '../watchBudget'

// Base64 frame of the largest stored head (5,357,733 B raw).
const LARGEST_FRAME = Math.ceil(5_357_733 / 3) * 4

// The calls run back to back with no await, which is the shape of a client that
// fires frames without waiting for replies.
describe('watch byte budget', () => {
  test('refuses a connection past the byte budget while its count stays under WATCH_MAX', () => {
    const connection = {}
    const now = 1_000
    const admitted: boolean[] = []
    for (let frame = 0; frame < 3; frame++) {
      expect(watchOverBudget(connection, now)).toBe(false)
      admitted.push(admitWatchBytes(connection, now, LARGEST_FRAME))
    }
    expect(admitted).toEqual([true, true, false])
  })

  test('admits the first frame in an empty window even when it is larger than the budget', () => {
    const connection = {}
    expect(admitWatchBytes(connection, 1_000, WATCH_MAX_BYTES + 1)).toBe(true)
    expect(admitWatchBytes(connection, 1_000, 1)).toBe(false)
  })

  test('frees the budget once the window passes', () => {
    const connection = {}
    const start = 1_000
    expect(admitWatchBytes(connection, start, LARGEST_FRAME)).toBe(true)
    expect(admitWatchBytes(connection, start, LARGEST_FRAME)).toBe(true)
    expect(admitWatchBytes(connection, start, LARGEST_FRAME)).toBe(false)
    expect(admitWatchBytes(connection, start + WATCH_WINDOW_MS, LARGEST_FRAME)).toBe(true)
  })

  test('holds one budget per connection', () => {
    const one = {}
    const two = {}
    expect(admitWatchBytes(one, 1_000, WATCH_MAX_BYTES)).toBe(true)
    expect(admitWatchBytes(one, 1_000, 1)).toBe(false)
    expect(admitWatchBytes(two, 1_000, LARGEST_FRAME)).toBe(true)
    expect(admitWatchBytes(two, 1_000, LARGEST_FRAME)).toBe(true)
  })
})
