import { describe, expect, it } from 'bun:test'

import { DANGEROUS_SCHEME_RE, getURLScheme, isSafeHref, validateURL } from '../validateURL'

/**
 * Pins `validateURL` (the gate every write boundary calls) for the three
 * shapes it has to recognize:
 *   1. Standard web URLs — http/https/ftp(s) with a plausible host.
 *   2. App / deep-link schemes — anything in `specialUrls.ts`.
 *   3. Domain-mapped web URLs — e.g. `wa.me/...` without a scheme.
 *
 * The asymmetry matters: linkifyjs alone would wave through
 * `https://googlecom` (no TLD) and reject `whatsapp://send` (unknown
 * scheme) — the helper exists to flip both decisions.
 */
describe('validateURL', () => {
  describe('rejects empty / whitespace input', () => {
    for (const input of ['', '   ', '\n\t']) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(validateURL(input)).toBe(false)
      })
    }
  })

  describe('standard web URLs', () => {
    it('accepts https with TLD', () => {
      expect(validateURL('https://example.com')).toBe(true)
    })

    it('accepts http with TLD', () => {
      expect(validateURL('http://example.com')).toBe(true)
    })

    it('accepts ftp with TLD', () => {
      expect(validateURL('ftp://files.example.com')).toBe(true)
    })

    it('accepts bare domain (linkify infers scheme)', () => {
      expect(validateURL('example.com')).toBe(true)
    })

    it('accepts localhost', () => {
      expect(validateURL('http://localhost')).toBe(true)
    })

    it('accepts localhost with port', () => {
      expect(validateURL('http://localhost:3000')).toBe(true)
    })

    it('accepts IPv4 literal', () => {
      expect(validateURL('http://127.0.0.1')).toBe(true)
    })
    // Bracketed IPv6 literals (`http://[::1]`) are not asserted here:
    // `hasPlausibleHost` accepts them, but linkifyjs's URL matcher
    // doesn't recognize the bracket form, so the assertion would pin
    // a third-party quirk rather than our own contract.
  })

  describe('bare E.164 phone numbers', () => {
    // Strict gate (full coverage in `phone.test.ts`); spot-check that
    // `validateURL` actually wires them through so the popover and
    // markdown input rule accept phones.
    it('accepts +4733378901', () => {
      expect(validateURL('+4733378901')).toBe(true)
    })

    it('accepts a formatted phone (+1 (555) 123-4567)', () => {
      expect(validateURL('+1 (555) 123-4567')).toBe(true)
    })

    it('rejects a bare numeric string (no leading +)', () => {
      expect(validateURL('5551234567')).toBe(false)
    })

    it('rejects too-short numbers (boundary)', () => {
      expect(validateURL('+1234567')).toBe(false)
    })
  })

  describe('rejects scheme-prefixed typos with no plausible host', () => {
    // linkifyjs accepts `https://googlecom` — `hasPlausibleHost` exists
    // exactly to catch this; pin it so a refactor of that gate doesn't
    // silently regress.
    for (const url of ['https://googlecom', 'https://asdf', 'http://nodot']) {
      it(`rejects ${url}`, () => {
        expect(validateURL(url)).toBe(false)
      })
    }
  })

  describe('app / deep-link schemes (selected coverage per category)', () => {
    // One-per-category smoke test; the full catalog lives in
    // specialUrls.test.ts and is exercised through `getSpecialUrlInfo`.
    const cases = [
      'mailto:user@example.com',
      'tel:+15551234567',
      'sms:+15551234567',
      'whatsapp://send?text=hello',
      'tg://msg?to=foo',
      'discord://channels/@me',
      'slack://open',
      'msteams://teams.microsoft.com/l/chat',
      'zoommtg://zoom.us/join?confno=123',
      'github://repo/owner/name',
      'vscode://file/Users/foo/bar.ts',
      'figma://file/abc',
      'spotify://track/abc',
      'maps://?q=Cupertino',
      'shortcuts://run-shortcut?name=foo'
    ]
    for (const url of cases) {
      it(`accepts ${url}`, () => {
        expect(validateURL(url)).toBe(true)
      })
    }
  })

  describe('domain-mapped web URLs (no explicit scheme on the catalog row)', () => {
    // These are real http(s) URLs whose host happens to live in
    // `DOMAIN_MAPPINGS`. They flow through the standard linkify path,
    // not the special-scheme branch.
    for (const url of [
      'wa.me/15551234567',
      't.me/durov',
      'github.com/docs-plus/docs.plus',
      'meet.google.com/abc-defg-hij'
    ]) {
      it(`accepts ${url}`, () => {
        expect(validateURL(url)).toBe(true)
      })
    }
  })

  describe('rejects non-URL noise', () => {
    for (const input of [
      'not a url',
      'just some text with spaces',
      'foo bar baz',
      '@handle',
      '#hashtag'
    ]) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(validateURL(input)).toBe(false)
      })
    }
  })

  describe('rejects dangerous XSS schemes (linkify never matches them)', () => {
    // `validateURL` is the gate that powers `<a href>` storage — any
    // `true` here would mean the editor accepts an XSS vector. The
    // `file:` / `blob:` cases pin the v2.x security-floor widening
    // (added defensively when `validateURL` started calling
    // `isSafeHref` upfront, so a future custom protocol registration
    // can never accidentally re-open these doors).
    for (const url of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("xss")',
      'file:///etc/passwd',
      'FILE:///etc/passwd',
      'blob:https://evil.example/abc',
      'BLOB:https://evil.example/abc',
      ' javascript:alert(1)',
      '\tdata:text/html,evil'
    ]) {
      it(`rejects ${url}`, () => {
        expect(validateURL(url)).toBe(false)
      })
    }
  })

  describe('customValidator option', () => {
    it('runs after the built-in checks for special schemes', () => {
      const httpsOnly = (url: string): boolean => /^https?:/i.test(url)
      expect(validateURL('mailto:user@example.com', { customValidator: httpsOnly })).toBe(false)
      expect(validateURL('https://example.com', { customValidator: httpsOnly })).toBe(true)
    })

    it('runs as a filter in the linkify match list for standard URLs', () => {
      const blockExample = (url: string): boolean => !url.includes('example.com')
      expect(validateURL('https://example.com', { customValidator: blockExample })).toBe(false)
      expect(validateURL('https://acme.com', { customValidator: blockExample })).toBe(true)
    })
  })
})

describe('getURLScheme', () => {
  it('returns the lowercased scheme', () => {
    expect(getURLScheme('HTTPS://Example.com')).toBe('https')
    expect(getURLScheme('mailto:foo@example.com')).toBe('mailto')
    expect(getURLScheme('WhatsApp://send')).toBe('whatsapp')
  })

  it('returns null when there is no colon', () => {
    expect(getURLScheme('example.com')).toBeNull()
    expect(getURLScheme('foo')).toBeNull()
  })

  it('returns null for empty / whitespace input', () => {
    expect(getURLScheme('')).toBeNull()
    expect(getURLScheme('   ')).toBeNull()
  })

  it('reads up to the first colon (not the last)', () => {
    expect(getURLScheme('mailto:foo:bar@example.com')).toBe('mailto')
  })
})

describe('DANGEROUS_SCHEME_RE', () => {
  // The regex is consumed by parseHTML / click-handler guards. Pinning
  // it here lets us catch a `^\s*` drop or a missing alternative.
  it('matches javascript:, data:, vbscript:, file:, blob: case-insensitively', () => {
    for (const url of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>',
      'vbscript:msgbox("xss")',
      'file:///etc/passwd',
      'FILE:///etc/passwd',
      'blob:https://evil.example/abc',
      'BLOB:https://evil.example/abc'
    ]) {
      expect(DANGEROUS_SCHEME_RE.test(url)).toBe(true)
    }
  })

  it('does not match safe schemes', () => {
    for (const url of [
      'https://example.com',
      'mailto:foo@example.com',
      'whatsapp://send',
      'data-foo://x',
      'fileserver://x',
      'blobby://x'
    ]) {
      expect(DANGEROUS_SCHEME_RE.test(url)).toBe(false)
    }
  })
})

describe('isSafeHref', () => {
  // Single XSS gate the extension uses at every WRITE boundary
  // (setHyperlink, paste handler, paste rule, input rule, parseHTML).
  // A regression here would let a hostile programmatic call land a
  // `javascript:` href in the document — pin all the cases.
  it('rejects empty / nullish hrefs', () => {
    expect(isSafeHref(null)).toBe(false)
    expect(isSafeHref(undefined)).toBe(false)
    expect(isSafeHref('')).toBe(false)
  })

  it('rejects every dangerous scheme', () => {
    for (const href of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      ' javascript:alert(1)',
      '\tjavascript:alert(1)',
      'data:text/html,<script>',
      'DATA:text/html,foo',
      'vbscript:msgbox("xss")',
      'file:///etc/passwd',
      'FILE:///etc/passwd',
      'blob:https://evil.example/abc',
      'BLOB:https://evil.example/abc'
    ]) {
      expect(isSafeHref(href)).toBe(false)
    }
  })

  it('accepts safe schemes (http(s), mailto, tel, deep links, bare domains)', () => {
    for (const href of [
      'https://example.com',
      'http://example.com/path?q=1',
      'mailto:foo@example.com',
      'tel:+15551234567',
      'whatsapp://send?text=hi',
      'wa.me/15551234567',
      'example.com',
      'data-foo://x'
    ]) {
      expect(isSafeHref(href)).toBe(true)
    }
  })

  it('narrows the type when used as a guard', () => {
    const value: string | null = 'https://example.com'
    if (isSafeHref(value)) {
      const safe: string = value
      expect(safe).toBe('https://example.com')
    } else {
      throw new Error('expected isSafeHref to narrow')
    }
  })
})
