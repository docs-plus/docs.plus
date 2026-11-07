import { describe, expect, it } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createMembersRead } from '../infra/membersRead'

/**
 * An `rpc` stand-in that answers `{ data, error }` as supabase-js does. With `answer` null it
 * waits for the abort, then answers an error, as postgrest-js does for an aborted request.
 */
const fakeClient = (answer: { data: unknown; error: unknown } | null) => {
  let calls = 0
  let signal: AbortSignal | undefined
  const client = {
    rpc: () => {
      calls++
      const builder = {
        abortSignal: (s: AbortSignal) => ((signal = s), builder),
        then: (resolve: (v: unknown) => void) => {
          if (answer) return resolve(answer)
          signal?.addEventListener('abort', () =>
            resolve({ data: null, error: { message: 'AbortError: aborted', code: '' } })
          )
        }
      }
      return builder
    }
  }
  return {
    client: client as unknown as SupabaseClient,
    calls: () => calls,
    signal: () => signal
  }
}

describe('createMembersRead', () => {
  it('returns the count and remembers it', async () => {
    const fake = fakeClient({ data: [{ document_id: 'd', member_count: 15 }], error: null })
    const read = createMembersRead(() => fake.client)
    expect(await read('d')).toBe(15)
    expect(await read('d')).toBe(15)
    expect(fake.calls()).toBe(1)
  })

  it('reads an empty answer as 0', async () => {
    const fake = fakeClient({ data: [], error: null })
    expect(await createMembersRead(() => fake.client)('d')).toBe(0)
  })

  it('returns null on an error and does not remember it', async () => {
    const fake = fakeClient({ data: null, error: { code: '42501' } })
    const read = createMembersRead(() => fake.client)
    expect(await read('d')).toBeNull()
    await read('d')
    expect(fake.calls()).toBe(2)
  })

  it('returns null with no client', async () => {
    expect(await createMembersRead(() => null)('d')).toBeNull()
  })

  it('aborts a read that never settles at the deadline', async () => {
    const fake = fakeClient(null)
    expect(await createMembersRead(() => fake.client, 50)('d')).toBeNull()
    expect(fake.signal()?.aborted).toBe(true)
  })
})
