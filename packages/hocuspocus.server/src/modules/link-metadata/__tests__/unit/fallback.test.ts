import { describe, expect, test } from 'bun:test'

import { runFallback } from '../../domain/stages/fallback'

describe('runFallback', () => {
  test('uses hostname as the title', () => {
    const result = runFallback('https://example.com/some/path')
    expect(result.title).toBe('example.com')
  })

  test('returns canonical url and requested url separately', () => {
    const result = runFallback('https://example.com/x', 'https://example.com/x?utm_source=foo')
    expect(result.url).toBe('https://example.com/x')
    expect(result.requested_url).toBe('https://example.com/x?utm_source=foo')
  })

  test('defaults requested_url to canonical when not provided', () => {
    const result = runFallback('https://example.com/x')
    expect(result.requested_url).toBe('https://example.com/x')
  })

  test('emits a google favicon service URL', () => {
    const result = runFallback('https://example.com/x')
    expect(result.favicon).toBe(
      'https://www.google.com/s2/favicons?domain=https%3A%2F%2Fexample.com&sz=64'
    )
  })

  test('still returns a usable shape for unparseable urls', () => {
    const result = runFallback('not a url')
    expect(result.title).toBe('not a url')
    expect(result.url).toBe('not a url')
    expect(result.favicon).toBeUndefined()
  })
})
