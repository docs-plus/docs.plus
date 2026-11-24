import { describe, expect, test } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import pino from 'pino'

import {
  createClientRedirects,
  createGrantRedirects,
  GRANT_LOOKUP_CONCURRENCY,
  MAX_GRANT_CLIENT_LOOKUPS
} from '../../infra/grantRedirects'

const logger = pino({ level: 'silent' })

const makeSupabase = (
  getClient: (clientId: string) => Promise<{
    data: unknown
    error: Error | null
  }>
): SupabaseClient =>
  ({
    auth: {
      admin: {
        oauth: { getClient }
      }
    }
  }) as unknown as SupabaseClient

const grantsFetch =
  (clientIds: string[], onCall?: (url: string, init?: RequestInit) => void) =>
  async (input: string, init?: RequestInit) => {
    onCall?.(input, init)
    return new Response(JSON.stringify(clientIds.map((id) => ({ client: { id } }))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

describe('createGrantRedirects', () => {
  test('sends supabaseAnonKey as apikey header on /auth/v1/user/oauth/grants', async () => {
    let seenUrl = ''
    let seenHeaders: Headers | undefined
    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => ({
        data: { client_id: id, redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] },
        error: null
      })),
      supabaseUrl: 'https://proj.supabase.co/',
      supabaseAnonKey: 'anon-key-123',
      logger,
      fetchImpl: grantsFetch(['c1'], (url, init) => {
        seenUrl = url
        seenHeaders = new Headers(init?.headers)
      })
    })

    const map = await grantRedirects('user-jwt')
    expect(seenUrl).toBe('https://proj.supabase.co/auth/v1/user/oauth/grants')
    expect(seenHeaders?.get('apikey')).toBe('anon-key-123')
    expect(seenHeaders?.get('Authorization')).toBe('Bearer user-jwt')
    expect(map).toEqual({ c1: ['https://claude.ai/api/mcp/auth_callback'] })
  })

  test('deduplicates repeated clientIds before calling getClient', async () => {
    const calls: string[] = []
    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => {
        calls.push(id)
        return { data: { client_id: id, redirect_uris: [`https://${id}.example/cb`] }, error: null }
      }),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: grantsFetch(['c1', 'c2', 'c1', 'c2', 'c1'])
    })

    const map = await grantRedirects('user-jwt')
    expect(calls).toEqual(['c1', 'c2'])
    expect(map).toEqual({
      c1: ['https://c1.example/cb'],
      c2: ['https://c2.example/cb']
    })
  })

  test('bounds getClient concurrency to GRANT_LOOKUP_CONCURRENCY', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const ids = Array.from({ length: 25 }, (_, idx) => `c-${idx}`)

    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => {
        inFlight++
        if (inFlight > maxInFlight) maxInFlight = inFlight
        await Promise.resolve()
        inFlight--
        return { data: { client_id: id, redirect_uris: ['https://app.example/cb'] }, error: null }
      }),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: grantsFetch(ids)
    })

    const map = await grantRedirects('user-jwt')
    expect(maxInFlight).toBeLessThanOrEqual(GRANT_LOOKUP_CONCURRENCY)
    expect(maxInFlight).toBeGreaterThan(1)
    expect(Object.keys(map)).toHaveLength(25)
  })

  test('caps lookups at MAX_GRANT_CLIENT_LOOKUPS', async () => {
    const ids = Array.from({ length: MAX_GRANT_CLIENT_LOOKUPS + 15 }, (_, idx) => `c-${idx}`)
    const seen: string[] = []

    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => {
        seen.push(id)
        return { data: { client_id: id, redirect_uris: ['https://app.example/cb'] }, error: null }
      }),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: grantsFetch(ids)
    })

    const map = await grantRedirects('user-jwt')
    expect(seen).toHaveLength(MAX_GRANT_CLIENT_LOOKUPS)
    expect(Object.keys(map)).toHaveLength(MAX_GRANT_CLIENT_LOOKUPS)
  })

  test('returns partial map when one getClient call fails or returns error', async () => {
    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => {
        if (id === 'bad-err') return { data: null, error: new Error('not found') }
        if (id === 'bad-throw') throw new Error('network boom')
        return { data: { client_id: id, redirect_uris: ['https://ok.example/cb'] }, error: null }
      }),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: grantsFetch(['ok-1', 'bad-err', 'bad-throw', 'ok-2'])
    })

    const map = await grantRedirects('user-jwt')
    expect(map).toEqual({
      'ok-1': ['https://ok.example/cb'],
      'ok-2': ['https://ok.example/cb']
    })
  })

  test('returns empty map when grant list fails or config is unset', async () => {
    const failingFetch = async () => new Response('boom', { status: 500 })
    const failed = createGrantRedirects({
      supabase: makeSupabase(async () => ({ data: null, error: null })),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: failingFetch
    })
    expect(await failed('user-jwt')).toEqual({})

    const unset = createGrantRedirects({
      supabase: null,
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger
    })
    expect(await unset('user-jwt')).toEqual({})
  })

  test('ignores malformed getClient data and filters non-string redirect_uris', async () => {
    const grantRedirects = createGrantRedirects({
      supabase: makeSupabase(async (id) => {
        if (id === 'empty') return { data: {}, error: null }
        if (id === 'null-uris') return { data: { client_id: id, redirect_uris: null }, error: null }
        if (id === 'str-uris') {
          return { data: { client_id: id, redirect_uris: 'https://x.com' }, error: null }
        }
        if (id === 'mixed-uris') {
          return {
            data: { client_id: id, redirect_uris: ['https://a.com', 123, null] },
            error: null
          }
        }
        return { data: { client_id: id, redirect_uris: ['https://ok.example/cb'] }, error: null }
      }),
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon',
      logger,
      fetchImpl: grantsFetch(['empty', 'null-uris', 'str-uris', 'mixed-uris', 'ok'])
    })

    expect(await grantRedirects('user-jwt')).toEqual({
      'mixed-uris': ['https://a.com'],
      ok: ['https://ok.example/cb']
    })
  })
})

describe('createClientRedirects', () => {
  test('returns redirect_uris when client exists and [] on error, throw, or null supabase', async () => {
    const reader = createClientRedirects({
      supabase: makeSupabase(async (id) => {
        if (id === 'missing') return { data: null, error: new Error('404') }
        if (id === 'throws') throw new Error('boom')
        return {
          data: {
            client_id: id,
            redirect_uris: ['https://claude.ai/api/mcp/auth_callback']
          },
          error: null
        }
      }),
      logger
    })

    expect(await reader('valid-id')).toEqual(['https://claude.ai/api/mcp/auth_callback'])
    expect(await reader('missing')).toEqual([])
    expect(await reader('throws')).toEqual([])

    const unset = createClientRedirects({ supabase: null, logger })
    expect(await unset('valid-id')).toEqual([])
  })

  test('returns [] on malformed getClient data and filters non-string redirect_uris', async () => {
    const reader = createClientRedirects({
      supabase: makeSupabase(async (id) => {
        if (id === 'empty') return { data: {}, error: null }
        if (id === 'null-uris') return { data: { client_id: id, redirect_uris: null }, error: null }
        if (id === 'str-uris') {
          return { data: { client_id: id, redirect_uris: 'https://x.com' }, error: null }
        }
        return {
          data: { client_id: id, redirect_uris: ['https://a.com', 123, null] },
          error: null
        }
      }),
      logger
    })

    expect(await reader('empty')).toEqual([])
    expect(await reader('null-uris')).toEqual([])
    expect(await reader('str-uris')).toEqual([])
    expect(await reader('mixed-uris')).toEqual(['https://a.com'])
  })
})
