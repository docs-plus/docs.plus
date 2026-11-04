/// <reference types="jest" />

import { getCachedMetadata } from './fetchMetadata'

const origin = window.location.origin

// A pad's answer depends on the reader, so it must never sit in the cache under its URL.
describe('getCachedMetadata', () => {
  beforeAll(() => window.history.pushState({}, '', '/pad-a'))

  it.each([
    ['another pad', `${origin}/other-pad`, null],
    ['an external page', 'https://example.com/post', undefined]
  ])('%s', (_name, href, expected) => {
    expect(getCachedMetadata(href)).toBe(expected)
  })
})
