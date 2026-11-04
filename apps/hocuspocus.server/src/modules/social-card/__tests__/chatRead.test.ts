import { describe, expect, it } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { CHAT_READS_IN_FLIGHT, createChatRead } from '../infra/chatRead'

const ROOM = {
  id: 'chan-1',
  heading_id: 'head-1',
  channel_message_counts: { message_count: 2 },
  last: [{ created_at: '2026-10-10T16:00:00.000Z' }]
}

/** A PostgREST stand-in: every builder call chains, and awaiting it answers after `delayMs`. */
const fakeClient = (answer: () => { data: unknown; error: unknown }, delayMs = 0) => {
  let reads = 0
  const client = {
    from: () => {
      reads++
      let signal: AbortSignal | undefined
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === 'abortSignal') {
              return (s: AbortSignal) => ((signal = s), builder)
            }
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) => {
                const timer = setTimeout(() => resolve(answer()), delayMs)
                signal?.addEventListener('abort', () => {
                  clearTimeout(timer)
                  resolve({ data: null, error: { message: 'AbortError' } })
                })
              }
            }
            return () => builder
          }
        }
      )
      return builder
    }
  }
  return { client: client as unknown as SupabaseClient, reads: () => reads }
}

describe('createChatRead', () => {
  it('remembers a found room and an absent room, but never an error', async () => {
    const found = fakeClient(() => ({ data: [ROOM], error: null }))
    const read = createChatRead(() => found.client)
    expect(await read('doc', 'head-1')).toEqual({ headingId: 'head-1', count: 2, message: null })
    await read('doc', 'head-1')
    expect(found.reads()).toBe(1)

    const absent = fakeClient(() => ({ data: [], error: null }))
    const readAbsent = createChatRead(() => absent.client)
    expect(await readAbsent('doc', 'nope')).toBeNull()
    await readAbsent('doc', 'nope')
    expect(absent.reads()).toBe(1)

    const failing = fakeClient(() => ({ data: null, error: { code: '500' } }))
    const readFailing = createChatRead(() => failing.client)
    expect(await readFailing('doc', 'head-1')).toBe('unavailable')
    await readFailing('doc', 'head-1')
    expect(failing.reads()).toBe(2)
  })

  it('aborts a slow read at the deadline and does not remember it', async () => {
    const slow = fakeClient(() => ({ data: [ROOM], error: null }), 200)
    const read = createChatRead(() => slow.client, 20)
    const started = performance.now()
    expect(await read('doc', 'head-1')).toBe('unavailable')
    expect(performance.now() - started).toBeLessThan(150)
    await read('doc', 'head-1')
    expect(slow.reads()).toBe(2)
  })

  it('sheds a read past the in-flight cap without a query', async () => {
    const slow = fakeClient(() => ({ data: [ROOM], error: null }), 30)
    const read = createChatRead(() => slow.client)
    const running = Array.from({ length: CHAT_READS_IN_FLIGHT }, (_, i) => read('doc', `room-${i}`))
    expect(await read('doc', 'one-more')).toBe('shed')
    expect(slow.reads()).toBe(CHAT_READS_IN_FLIGHT)
    await Promise.all(running)
  })

  it('shares one query between concurrent reads of one key, so a spike sheds nothing', async () => {
    const slow = fakeClient(() => ({ data: [ROOM], error: null }), 30)
    const read = createChatRead(() => slow.client)
    const answers = await Promise.all(Array.from({ length: 50 }, () => read('doc', 'head-1')))
    expect(slow.reads()).toBe(1)
    expect(answers).toEqual(Array(50).fill({ headingId: 'head-1', count: 2, message: null }))
  })

  it('refuses a bad id shape with no read, and counts reactions, never people', async () => {
    const message = {
      ...ROOM,
      heading_id: 'doc',
      linked: [
        {
          created_at: '2026-10-10T16:35:56.139Z',
          type: 'text',
          reactions: { '👍': [{ user_id: 'u1' }, { user_id: 'u2' }], '🎉': [] },
          replied: ['r1', 'r2', 'r3']
        }
      ]
    }
    const fake = fakeClient(() => ({ data: [message], error: null }))
    const read = createChatRead(() => fake.client)
    expect(await read('doc', 'a,b)')).toBeNull()
    expect(fake.reads()).toBe(0)
    const facts = await read('doc', 'doc', 'ccc0bc0d-52f8-43e8-adfa-e7519e4ae01e')
    if (typeof facts === 'string' || !facts) throw new Error('expected a room')
    expect(facts.headingId).toBeNull()
    expect(facts.message?.reactions).toEqual({ '👍': 2 })
    expect(facts.message?.replies).toBe(3)
  })
})
