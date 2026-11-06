import { describe, expect, test } from 'bun:test'

import { cacheKey } from '../../domain/stages/cache'

describe('cacheKey', () => {
  test('uses meta:v4: prefix, sha1 of the canonical url, and the primary lang subtag', () => {
    const key = cacheKey('https://example.com/x', 'en-US')
    expect(key).toMatch(/^meta:v4:[a-f0-9]{40}:en$/)
  })

  test('collapses a full Accept-Language header to its primary subtag', () => {
    const key = cacheKey('https://example.com/x', 'en-US,en;q=0.9,fr;q=0.8')
    expect(key).toBe(cacheKey('https://example.com/x', 'en'))
  })

  test('collapses a non-language token to "_" so cardinality stays bounded', () => {
    expect(cacheKey('https://example.com/x', 'zzzz').endsWith(':_')).toBe(true)
    expect(cacheKey('https://example.com/x', 'garbage-value')).toBe(
      cacheKey('https://example.com/x', undefined)
    )
  })

  test('uses "_" when lang is undefined', () => {
    const key = cacheKey('https://example.com/x', undefined)
    expect(key.endsWith(':_')).toBe(true)
  })

  test('two different urls produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://b.com', 'en'))
  })

  test('two different langs produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://a.com', 'fr'))
  })
})
