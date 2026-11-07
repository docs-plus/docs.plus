import { describe, expect, it } from 'bun:test'

import { createGuardedRead, type GuardOutcome } from '../infra/renderGuards'

describe('createGuardedRead', () => {
  it('sheds the fifth of five reads that never settle, after 4 queries', async () => {
    const outcomes: GuardOutcome[] = []
    let queries = 0
    const read = createGuardedRead<object, string | null>({
      getClient: () => ({}),
      cap: 4,
      memoMs: 60_000,
      memoMax: 1000,
      keep: (value) => value !== null,
      shed: null,
      noClient: null,
      count: (outcome) => outcomes.push(outcome),
      startTimer: () => () => {}
    })
    const never = () => {
      queries++
      return new Promise<string | null>(() => {})
    }
    for (const key of ['a', 'b', 'c', 'd']) void read(key, never)
    expect(await read('e', never)).toBeNull()
    expect(queries).toBe(4)
    expect(outcomes).toEqual(['shed'])
  })
})
