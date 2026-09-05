import { describe, expect, test } from 'bun:test'

import {
  isTransientAuthFailure,
  verifySupabaseTokenOutcome,
  type VerifyTokenOptions
} from '../auth'

type GetUserResult = Awaited<ReturnType<NonNullable<VerifyTokenOptions['getUser']>>>

function stubGetUser(resolve: () => GetUserResult): NonNullable<VerifyTokenOptions['getUser']> {
  return async () => resolve()
}

describe('isTransientAuthFailure', () => {
  test('treats 429, 5xx, and missing status as transient', () => {
    expect(isTransientAuthFailure({ status: 429 })).toBe(true)
    expect(isTransientAuthFailure({ status: 503 })).toBe(true)
    expect(isTransientAuthFailure({ message: 'network' } as { status?: number })).toBe(true)
  })

  test('treats definitive 4xx as non-transient', () => {
    expect(isTransientAuthFailure({ status: 401 })).toBe(false)
    expect(isTransientAuthFailure({ status: 403 })).toBe(false)
    expect(isTransientAuthFailure(null)).toBe(false)
  })
})

describe('verifySupabaseTokenOutcome', () => {
  test('returns user on success', async () => {
    const outcome = await verifySupabaseTokenOutcome('tok-success', {
      getUser: stubGetUser(() => ({
        data: { user: { id: 'u1', email: 'a@b.c' } },
        error: null
      }))
    })
    expect(outcome).toEqual({
      kind: 'user',
      user: { sub: 'u1', email: 'a@b.c', is_anonymous: undefined, user_metadata: undefined }
    })
  })

  test('returns invalid for a definitive 4xx', async () => {
    const outcome = await verifySupabaseTokenOutcome('tok-definitive-401', {
      getUser: stubGetUser(() => ({
        data: { user: null },
        error: { status: 401, message: 'bad jwt' }
      }))
    })
    expect(outcome).toEqual({ kind: 'invalid' })
  })

  test('returns unavailable on 5xx / network / 429', async () => {
    for (const [token, error] of [
      ['tok-transient-5xx', { status: 503, message: 'upstream down' }],
      ['tok-transient-nostatus', { message: 'network' }],
      ['tok-transient-429', { status: 429, message: 'slow down' }]
    ] as const) {
      const outcome = await verifySupabaseTokenOutcome(token, {
        getUser: stubGetUser(() => ({ data: { user: null }, error }))
      })
      expect(outcome.kind).toBe('unavailable')
    }
  })

  test('negative-caches a definitive invalid token across a later valid backend', async () => {
    let phase: 'invalid' | 'valid' = 'invalid'
    const getUser = stubGetUser(() =>
      phase === 'invalid'
        ? { data: { user: null }, error: { status: 401, message: 'bad jwt' } }
        : { data: { user: { id: 'u-late', email: 'l@x.c' } }, error: null }
    )

    expect(await verifySupabaseTokenOutcome('tok-neg-cache', { getUser })).toEqual({
      kind: 'invalid'
    })
    phase = 'valid'
    // Same token string must stay invalid for the negative-cache window.
    expect(await verifySupabaseTokenOutcome('tok-neg-cache', { getUser })).toEqual({
      kind: 'invalid'
    })
  })

  test('does not cache an unavailable failure', async () => {
    let phase: 'down' | 'up' = 'down'
    const getUser = stubGetUser(() =>
      phase === 'down'
        ? { data: { user: null }, error: { status: 503, message: 'upstream down' } }
        : { data: { user: { id: 'u-flip', email: 'f@x.c' } }, error: null }
    )

    expect((await verifySupabaseTokenOutcome('tok-flip', { getUser })).kind).toBe('unavailable')
    phase = 'up'
    const outcome = await verifySupabaseTokenOutcome('tok-flip', { getUser })
    expect(outcome).toEqual({
      kind: 'user',
      user: {
        sub: 'u-flip',
        email: 'f@x.c',
        is_anonymous: undefined,
        user_metadata: undefined
      }
    })
  })

  test('maps a thrown getUser to unavailable', async () => {
    const outcome = await verifySupabaseTokenOutcome('tok-throw', {
      getUser: async () => {
        throw new Error('socket hang up')
      }
    })
    expect(outcome.kind).toBe('unavailable')
  })

  // Last in the file on purpose: filling the cache evicts the tokens seeded above.
  // It asserts only on tokens it inserts itself. Anything already cached is older,
  // so it is evicted before the first flood token, whatever ran before.
  test('evicts the oldest token instead of clearing the whole cache', async () => {
    let calls = 0
    const getUser = stubGetUser(() => {
      calls += 1
      return { data: { user: { id: 'u-flood', email: 'f@flood.c' } }, error: null }
    })

    // MAX_TOKEN_CACHE is 1000, so 1001 distinct tokens overflow it by exactly one.
    for (let i = 0; i <= 1000; i += 1) {
      await verifySupabaseTokenOutcome(`tok-flood-${i}`, { getUser })
    }
    expect(calls).toBe(1001)

    // The survivor is read first. Re-verifying the evicted token below re-caches it,
    // and that set evicts whatever is then oldest — which is this very token.
    await verifySupabaseTokenOutcome('tok-flood-1', { getUser })
    expect(calls).toBe(1001)

    // Only the oldest was dropped, so it costs one fresh Supabase Auth round trip.
    // A clear() would have made every one of the 1000 survivors cost one instead.
    await verifySupabaseTokenOutcome('tok-flood-0', { getUser })
    expect(calls).toBe(1002)
  })
})
