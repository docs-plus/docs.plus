import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, test } from 'bun:test'

import { getOwnerProfile, OWNER_PROFILE_DEADLINE_MS } from '../profiles'

// A PostgREST that accepts the request and never answers. A plain client has no
// timedFetch, so the profile deadline is the only bound on the read.
const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) })

afterAll(() => {
  server.stop(true)
})

describe('getOwnerProfile', () => {
  test('returns null within the deadline when the read stalls', async () => {
    const client = createClient(`http://localhost:${server.port}`, 'test-key', {
      auth: { persistSession: false }
    })

    const started = performance.now()
    const profile = await getOwnerProfile('u1', client)
    const elapsed = performance.now() - started

    expect(profile).toBeNull()
    expect(elapsed).toBeLessThan(OWNER_PROFILE_DEADLINE_MS + 500)
  })
})
