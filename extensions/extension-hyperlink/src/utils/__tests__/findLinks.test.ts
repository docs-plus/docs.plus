import { describe, expect, it } from 'bun:test'

import { findLinks } from '../findLinks'

/**
 * `findLinks` is the pure core of the autolink plugin. Tested here rather
 * than through Cypress so the matcher behaviour is pinned without spinning
 * up a ProseMirror editor.
 */
describe('findLinks', () => {
  describe('standard URLs', () => {
    it('finds a single http(s) URL', () => {
      const result = findLinks('https://example.com')
      expect(result).toHaveLength(1)
      expect(result[0].href).toBe('https://example.com')
      expect(result[0].value).toBe('https://example.com')
      expect(result[0].type).toBe('url')
    })

    it('finds a bare-domain URL via linkifyjs', () => {
      const result = findLinks('example.com')
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe('example.com')
    })
  })

  describe('emails', () => {
    it('emits a mailto: href for bare email matches', () => {
      const result = findLinks('user@example.com')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('email')
      expect(result[0].href).toBe('mailto:user@example.com')
    })
  })

  describe('special schemes (app deep-links)', () => {
    it('finds whatsapp:// even though linkifyjs has no matcher for it', () => {
      // Custom-scheme matches go through validateURL → getSpecialUrlInfo,
      // which means only KNOWN deep-link schemes survive this pass.
      // Random `foo:bar` strings are rejected upstream.
      const result = findLinks('whatsapp://send?text=hi')
      expect(result.some((l) => l.href === 'whatsapp://send?text=hi')).toBe(true)
    })

    it('does not double-emit when linkifyjs already covers the range', () => {
      // linkifyjs accepts `mailto:` natively. The special-scheme pass
      // would also match `mailto:user@example.com` syntactically, so
      // findLinks deduplicates by checking `alreadyCovered`.
      const result = findLinks('mailto:user@example.com')
      const mailtos = result.filter((l) => l.href === 'mailto:user@example.com')
      expect(mailtos).toHaveLength(1)
    })
  })

  describe('phones', () => {
    it('emits tel: for bare E.164 phones with the canonical href', () => {
      const result = findLinks('+15551234567')
      const phone = result.find((l) => l.type === 'phone')
      expect(phone?.href).toBe('tel:+15551234567')
      expect(phone?.value).toBe('+15551234567')
    })

    it('does not emit phones for short numeric strings', () => {
      // 7 digits — below the E.164 minimum (8). Pinning so a regex
      // loosening here would require an explicit test update.
      expect(findLinks('1234567')).toEqual([])
    })
  })

  describe('trailing punctuation', () => {
    it('strips trailing punctuation from URL matches', () => {
      const result = findLinks('example.com.')
      const url = result.find((l) => l.value === 'example.com')
      expect(url).toBeDefined()
      expect(url?.end).toBe('example.com'.length)
    })

    it('strips trailing punctuation from special-scheme matches', () => {
      const result = findLinks('whatsapp://send.')
      const url = result.find((l) => l.value === 'whatsapp://send')
      expect(url).toBeDefined()
      expect(url?.href).toBe('whatsapp://send')
    })

    it('leaves the href untouched when only the value carries the trailing char', () => {
      // `value` and `href` both end with the dot here, so both lose it —
      // the strip only touches `href` when it shares the trailing chars.
      const result = findLinks('user@example.com.')
      const email = result.find((l) => l.type === 'email')
      expect(email?.value).toBe('user@example.com')
      expect(email?.href).toBe('mailto:user@example.com')
    })
  })

  describe('empty + no-match inputs', () => {
    it('returns an empty array for an empty string', () => {
      expect(findLinks('')).toEqual([])
    })

    it('returns an empty array for plain prose', () => {
      expect(findLinks('hello world')).toEqual([])
    })
  })
})
