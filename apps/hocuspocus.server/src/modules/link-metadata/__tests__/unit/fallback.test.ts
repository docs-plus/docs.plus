import { describe, expect, test } from 'bun:test'

import { runFallback } from '../../domain/stages/fallback'

describe('runFallback', () => {
  test('uses hostname as the title', () => {
    const result = runFallback('https://example.com/some/path')
    expect(result.title).toBe('example.com')
  })

  test('emits the icon route URL when publicUrl is set', () => {
    const result = runFallback('https://example.com/x', 'http://localhost:4000')
    expect(result.favicon).toBe(
      'http://localhost:4000/api/metadata/icon?origin=https%3A%2F%2Fexample.com'
    )
  })

  test('still returns a usable shape for unparseable urls', () => {
    const result = runFallback('not a url')
    expect(result.title).toBe('not a url')
    expect(result.url).toBe('not a url')
    expect(result.favicon).toBeUndefined()
  })
})
