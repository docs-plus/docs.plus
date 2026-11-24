import { describe, expect, test } from 'bun:test'

import { envSchema } from '../env.schema'

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key'
}

describe('envSchema', () => {
  describe('PUBLIC_RESTAPI_URL', () => {
    test('treats unset, empty, and whitespace-only values as undefined', () => {
      for (const value of [undefined, '', '   ']) {
        const parsed = envSchema.safeParse({ ...REQUIRED_ENV, PUBLIC_RESTAPI_URL: value })
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.PUBLIC_RESTAPI_URL).toBeUndefined()
      }
    })

    test('normalizes valid http and https origins by stripping a trailing root slash', () => {
      const cases = [
        ['https://api.example.com', 'https://api.example.com'],
        ['https://api.example.com/', 'https://api.example.com'],
        ['  http://localhost:4000/  ', 'http://localhost:4000']
      ] as const

      for (const [input, expected] of cases) {
        const parsed = envSchema.safeParse({ ...REQUIRED_ENV, PUBLIC_RESTAPI_URL: input })
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.PUBLIC_RESTAPI_URL).toBe(expected)
      }
    })

    test('rejects path suffixes, queries, fragments, credentials, non-http schemes, and invalid URLs', () => {
      const invalid = [
        'https://api.example.com/api',
        'https://api.example.com/api/',
        'https://api.example.com//',
        'https://api.example.com?foo=bar',
        'https://api.example.com#frag',
        'https://user:pass@api.example.com',
        'ftp://api.example.com',
        'not-a-url'
      ]

      for (const value of invalid) {
        const parsed = envSchema.safeParse({ ...REQUIRED_ENV, PUBLIC_RESTAPI_URL: value })
        expect(parsed.success).toBe(false)
      }
    })
  })

  describe('MCP_AUTH_ISSUER', () => {
    test('strips trailing slashes and treats empty or slash-only values as undefined', () => {
      expect(
        envSchema.safeParse({ ...REQUIRED_ENV, MCP_AUTH_ISSUER: 'https://auth.example/auth/v1/' })
      ).toMatchObject({ success: true, data: { MCP_AUTH_ISSUER: 'https://auth.example/auth/v1' } })

      expect(
        envSchema.safeParse({
          ...REQUIRED_ENV,
          MCP_AUTH_ISSUER: '  https://auth.example/auth/v1///  '
        })
      ).toMatchObject({ success: true, data: { MCP_AUTH_ISSUER: 'https://auth.example/auth/v1' } })

      for (const empty of [undefined, '', '   ', '///']) {
        const parsed = envSchema.safeParse({ ...REQUIRED_ENV, MCP_AUTH_ISSUER: empty })
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.MCP_AUTH_ISSUER).toBeUndefined()
      }
    })
  })

  describe('HOCUSPOCUS_INTERNAL_ADVERTISE_URL and HOCUSPOCUS_INTERNAL_PEERS', () => {
    test('normalizes valid bare origins and defaults cleanly when unset', () => {
      const defaults = envSchema.safeParse(REQUIRED_ENV)
      expect(defaults.success).toBe(true)
      if (defaults.success) {
        expect(defaults.data.HOCUSPOCUS_INTERNAL_ADVERTISE_URL).toBeUndefined()
        expect(defaults.data.HOCUSPOCUS_INTERNAL_PEERS).toEqual([])
      }

      const configured = envSchema.safeParse({
        ...REQUIRED_ENV,
        HOCUSPOCUS_INTERNAL_ADVERTISE_URL: ' http://172.18.0.5:4003/ ',
        HOCUSPOCUS_INTERNAL_PEERS: 'http://127.0.0.1:41001/, http://127.0.0.1:41002'
      })
      expect(configured.success).toBe(true)
      if (configured.success) {
        expect(configured.data.HOCUSPOCUS_INTERNAL_ADVERTISE_URL).toBe('http://172.18.0.5:4003')
        expect(configured.data.HOCUSPOCUS_INTERNAL_PEERS).toEqual([
          'http://127.0.0.1:41001',
          'http://127.0.0.1:41002'
        ])
      }
    })

    test('rejects paths, queries, credentials, and non-http schemes', () => {
      for (const bad of [
        'http://172.18.0.5:4003/internal',
        'http://user:pass@172.18.0.5:4003',
        'ftp://172.18.0.5:4003'
      ]) {
        expect(
          envSchema.safeParse({ ...REQUIRED_ENV, HOCUSPOCUS_INTERNAL_ADVERTISE_URL: bad }).success
        ).toBe(false)
        expect(
          envSchema.safeParse({ ...REQUIRED_ENV, HOCUSPOCUS_INTERNAL_PEERS: bad }).success
        ).toBe(false)
      }
    })
  })

  describe('HOCUSPOCUS_INTERNAL_URL', () => {
    test('defaults to http://localhost:4003 when unset or blank and normalizes trailing slashes', () => {
      for (const empty of [undefined, '', '   ']) {
        const parsed = envSchema.safeParse({ ...REQUIRED_ENV, HOCUSPOCUS_INTERNAL_URL: empty })
        expect(parsed.success).toBe(true)
        if (parsed.success) {
          expect(parsed.data.HOCUSPOCUS_INTERNAL_URL).toBe('http://localhost:4003')
        }
      }

      const normalized = envSchema.safeParse({
        ...REQUIRED_ENV,
        HOCUSPOCUS_INTERNAL_URL: ' http://hocuspocus-server:4003/ '
      })
      expect(normalized.success).toBe(true)
      if (normalized.success) {
        expect(normalized.data.HOCUSPOCUS_INTERNAL_URL).toBe('http://hocuspocus-server:4003')
      }
    })

    test('rejects invalid URLs, non-http schemes, paths, queries, and credentials', () => {
      for (const bad of [
        'not-a-url',
        'ftp://hocuspocus-server:4003',
        'http://hocuspocus-server:4003/internal',
        'http://user:pass@hocuspocus-server:4003'
      ]) {
        expect(envSchema.safeParse({ ...REQUIRED_ENV, HOCUSPOCUS_INTERNAL_URL: bad }).success).toBe(
          false
        )
      }
    })
  })
})
