import { describe, expect, it } from 'bun:test'

import { normalizeHref, normalizeLinkifyHref } from '../normalizeHref'

/**
 * Pins the canonicalization contract of `normalizeHref`. Every write
 * boundary in the extension funnels through this helper:
 *   - create popover submit
 *   - edit popover submit
 *   - `setLink` programmatic command
 *   - markdown input rule (`[text](url)`)
 *   - autolink + paste (via `normalizeLinkifyHref`)
 *
 * A regression here ships a wrong `<a href>` to every consumer.
 */
describe('normalizeHref', () => {
  describe('trimming and empty inputs', () => {
    it('returns "" for empty string', () => {
      expect(normalizeHref('')).toBe('')
    })

    it('returns "" for whitespace-only input', () => {
      expect(normalizeHref('   \t\n')).toBe('')
    })

    it('trims surrounding whitespace before normalizing', () => {
      expect(normalizeHref('  google.com  ')).toBe('https://google.com')
    })
  })

  describe('absolute URLs are returned unchanged', () => {
    for (const url of [
      'https://example.com',
      'http://example.com',
      'ftp://files.example.com',
      'ftps://files.example.com',
      'https://example.com/path?q=1#frag'
    ]) {
      it(`preserves ${url}`, () => {
        expect(normalizeHref(url)).toBe(url)
      })
    }

    it('preserves protocol-relative refs', () => {
      expect(normalizeHref('//cdn.example.com/lib.js')).toBe('//cdn.example.com/lib.js')
    })
  })

  describe('app deep-link schemes are returned unchanged', () => {
    for (const url of [
      'mailto:hi@example.com',
      'tel:+15551234567',
      'sms:+15551234567',
      'whatsapp://send?text=hi',
      'tg://msg?to=foo',
      'github://repo/owner/name',
      'vscode://file/Users/foo/bar.ts'
    ]) {
      it(`preserves ${url}`, () => {
        expect(normalizeHref(url)).toBe(url)
      })
    }
  })

  describe('custom protocols are preserved (registerCustomProtocol contract)', () => {
    // Single-token schemes (no dot, not localhost, not an IP) are
    // trusted as real schemes regardless of whether they're in the
    // built-in catalog. This is the contract documented in
    // `hyperlink.ts` for `registerCustomProtocol(...)` consumers.
    for (const url of ['mychat:room/123', 'docsy:doc/abc', 'app:open?id=1', 'foo:bar']) {
      it(`preserves ${url}`, () => {
        expect(normalizeHref(url)).toBe(url)
      })
    }
  })

  describe('bare domains get https:// prepended', () => {
    for (const [input, expected] of [
      ['google.com', 'https://google.com'],
      ['example.com/path?q=1', 'https://example.com/path?q=1'],
      ['files.example.com', 'https://files.example.com'],
      ['example.com#frag', 'https://example.com#frag']
    ]) {
      it(`${input} → ${expected}`, () => {
        expect(normalizeHref(input)).toBe(expected)
      })
    }
  })

  describe('host:port pseudo-schemes get https:// prepended (regression)', () => {
    // BUG-FIX: `localhost:3000` matched the old `^[a-z][...]+:` regex
    // and was returned unchanged — the browser then interpreted
    // `localhost:` as a scheme name and the link broke. The fix
    // disambiguates host-shaped strings from real schemes.
    for (const [input, expected] of [
      ['localhost:3000', 'https://localhost:3000'],
      ['localhost:8080/admin', 'https://localhost:8080/admin'],
      ['mydomain.com:8080', 'https://mydomain.com:8080'],
      ['127.0.0.1:8080', 'https://127.0.0.1:8080'],
      ['files.example.com:443/foo', 'https://files.example.com:443/foo']
    ]) {
      it(`${input} → ${expected}`, () => {
        expect(normalizeHref(input)).toBe(expected)
      })
    }
  })

  describe('bare phone numbers become tel: (E.164 only)', () => {
    // Strict E.164 contract: must start with `+`, 8–15 digits.
    // `tel:` is canonicalized to digits-only per RFC 3966 even when
    // the user typed formatting (display text in the doc is
    // unaffected — only the href).
    for (const [input, expected] of [
      ['+4733378901', 'tel:+4733378901'],
      ['+15551234567', 'tel:+15551234567'],
      ['+1 (555) 123-4567', 'tel:+15551234567'],
      ['+1-555-123-4567', 'tel:+15551234567'],
      ['  +4733378901  ', 'tel:+4733378901']
    ]) {
      it(`${input} → ${expected}`, () => {
        expect(normalizeHref(input)).toBe(expected)
      })
    }

    it('does not autoconvert numbers without the leading + (no false positives in prose)', () => {
      // Years, ZIP codes, and bare numerics must NOT be reinterpreted
      // as phones — they would be silently linkified to broken `tel:`.
      expect(normalizeHref('2024')).toBe('https://2024')
      expect(normalizeHref('5551234567')).toBe('https://5551234567')
    })

    it('does not double-prefix an explicit tel:', () => {
      expect(normalizeHref('tel:+4733378901')).toBe('tel:+4733378901')
    })
  })

  describe('bare emails become mailto: (regression)', () => {
    // BUG-FIX: bare emails went through the URL-prepend branch and
    // came out as `https://user@example.com` — a syntactically valid
    // URL with HTTP basic-auth credentials, which is *not* what the
    // user typed. Matches what the autolink path already emits for
    // whitespace-detected emails.
    for (const [input, expected] of [
      ['user@example.com', 'mailto:user@example.com'],
      ['hi+filter@example.com', 'mailto:hi+filter@example.com'],
      ['USER@Example.COM', 'mailto:USER@Example.COM'],
      ['  user@example.com  ', 'mailto:user@example.com']
    ]) {
      it(`${input} → ${expected}`, () => {
        expect(normalizeHref(input)).toBe(expected)
      })
    }

    it('only converts when the entire trimmed input is one email', () => {
      // Defence-in-depth: don't mangle sentences that happen to
      // contain an email — they were never valid hyperlink targets,
      // and the popover's `validateURL` would have rejected them
      // upstream. We assert the *value* the helper would emit so a
      // refactor that loosens the strict-match check is caught here.
      expect(normalizeHref('hello user@example.com')).not.toBe('mailto:user@example.com')
      expect(normalizeHref('user@example.com is my email')).not.toBe('mailto:user@example.com')
    })

    it('does not double-prefix an explicit mailto:', () => {
      expect(normalizeHref('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    })
  })
})

describe('normalizeLinkifyHref', () => {
  it('routes URL matches through normalizeHref(value)', () => {
    expect(
      normalizeLinkifyHref({ type: 'url', value: 'google.com', href: 'http://google.com' })
    ).toBe('https://google.com')
  })

  it('returns href as-is for email matches (preserves linkifyjs mailto:)', () => {
    expect(
      normalizeLinkifyHref({
        type: 'email',
        value: 'user@example.com',
        href: 'mailto:user@example.com'
      })
    ).toBe('mailto:user@example.com')
  })

  it('returns href as-is for non-URL match types', () => {
    expect(
      normalizeLinkifyHref({ type: 'mention', value: '@foo', href: 'https://example.com/foo' })
    ).toBe('https://example.com/foo')
  })
})
