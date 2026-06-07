import { describe, expect, test } from 'bun:test'

import { canonicalize } from '../../domain/canonicalize'

describe('canonicalize', () => {
  test('strips utm_* params', () => {
    expect(canonicalize('https://example.com/x?utm_source=newsletter&utm_medium=email')).toBe(
      'https://example.com/x'
    )
  })

  test('strips fbclid, gclid, mc_eid, ref_src, igshid, _hsenc, yclid', () => {
    const url =
      'https://example.com/x?fbclid=a&gclid=b&mc_eid=c&ref_src=d&igshid=e&_hsenc=f&yclid=g&keep=1'
    expect(canonicalize(url)).toBe('https://example.com/x?keep=1')
  })

  test('preserves query params not in the strip list', () => {
    expect(canonicalize('https://example.com/?id=42&utm_source=x')).toBe(
      'https://example.com/?id=42'
    )
  })

  test('preserves hash fragment', () => {
    expect(canonicalize('https://example.com/x?utm_source=x#section')).toBe(
      'https://example.com/x#section'
    )
  })

  test('lowercases hostname but preserves path case', () => {
    expect(canonicalize('https://EXAMPLE.com/PATH')).toBe('https://example.com/PATH')
  })

  test('removes default ports (80 for http, 443 for https)', () => {
    expect(canonicalize('https://example.com:443/x')).toBe('https://example.com/x')
    expect(canonicalize('http://example.com:80/x')).toBe('http://example.com/x')
  })

  test('returns the input unchanged if URL parsing fails', () => {
    expect(canonicalize('not a url')).toBe('not a url')
  })

  test('collapses repeated tracking-param occurrences', () => {
    expect(canonicalize('https://example.com/?utm_source=a&utm_source=b&keep=1')).toBe(
      'https://example.com/?keep=1'
    )
  })

  test('punycodes IDN hosts (Unicode and ASCII forms map to the same canonical)', () => {
    const unicode = canonicalize('https://例え.jp/')
    const ascii = canonicalize('https://xn--r8jz45g.jp/')
    expect(unicode).toBe(ascii)
  })

  test('lowercases the scheme', () => {
    expect(canonicalize('HTTPS://example.com/')).toBe('https://example.com/')
  })

  test('strips an empty query suffix', () => {
    expect(canonicalize('https://example.com/?')).toBe('https://example.com/')
  })

  test('also strips msclkid, mc_cid, mkt_tok, ttclid, li_fat_id', () => {
    const url = 'https://example.com/x?msclkid=a&mc_cid=b&mkt_tok=c&ttclid=d&li_fat_id=e&keep=1'
    expect(canonicalize(url)).toBe('https://example.com/x?keep=1')
  })

  test('strips an empty query before a fragment', () => {
    expect(canonicalize('https://example.com/?#section')).toBe('https://example.com/#section')
  })
})
