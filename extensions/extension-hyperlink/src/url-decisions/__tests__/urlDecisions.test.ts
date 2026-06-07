import { describe, expect, it } from 'bun:test'

import { composeGate, createURLDecisions, type URLDecisions, type WriteResult } from '../index'

/**
 * Pins the URL Decision Pipeline — the single module every other write
 * and read surface routes through. Tests are organized by method
 * (`forWrite` / `forRead`) and within each by input shape so a regression
 * tells you exactly which boundary drifted.
 *
 * `forWrite` matrix: { text | href | match } × { gate | validate | shouldAutoLink }
 * `forRead`  matrix: { safe | unsafe } × { default-gate | composed-gate }
 */

const ds = (overrides?: Parameters<typeof createURLDecisions>[0]): URLDecisions =>
  createURLDecisions(overrides)

const onlyHrefs = (results: WriteResult[]): string[] => results.map((r) => r.href)

describe('createURLDecisions', () => {
  describe('forWrite — kind: href (explicit user-supplied)', () => {
    it('normalizes a bare domain using defaultProtocol', () => {
      const out = ds().forWrite({ kind: 'href', href: 'google.com' })
      expect(onlyHrefs(out)).toEqual(['https://google.com'])
    })

    it('honors a custom defaultProtocol', () => {
      const out = ds({ defaultProtocol: 'http' }).forWrite({ kind: 'href', href: 'google.com' })
      expect(onlyHrefs(out)).toEqual(['http://google.com'])
    })

    it('passes through an absolute URL unchanged', () => {
      const out = ds().forWrite({ kind: 'href', href: 'https://example.com/path' })
      expect(onlyHrefs(out)).toEqual(['https://example.com/path'])
    })

    it('canonicalizes a bare email to mailto:', () => {
      const out = ds().forWrite({ kind: 'href', href: 'user@example.com' })
      expect(onlyHrefs(out)).toEqual(['mailto:user@example.com'])
    })

    it('canonicalizes an E.164 phone to tel:', () => {
      const out = ds().forWrite({ kind: 'href', href: '+1 555 123 4567' })
      expect(onlyHrefs(out)).toEqual(['tel:+15551234567'])
    })

    it('rejects empty / whitespace input', () => {
      expect(ds().forWrite({ kind: 'href', href: '' })).toEqual([])
      expect(ds().forWrite({ kind: 'href', href: '   ' })).toEqual([])
    })

    it('rejects dangerous schemes regardless of options', () => {
      for (const dangerous of [
        'javascript:alert(1)',
        'data:text/html,foo',
        'vbscript:msgbox',
        'file:///etc/passwd',
        'blob:http://example.com/abc'
      ]) {
        expect(ds().forWrite({ kind: 'href', href: dangerous })).toEqual([])
      }
    })

    it('runs a per-call validate veto', () => {
      const veto = ds().forWrite(
        { kind: 'href', href: 'https://example.com' },
        { validate: () => false }
      )
      expect(veto).toEqual([])

      const accept = ds().forWrite(
        { kind: 'href', href: 'https://example.com' },
        { validate: () => true }
      )
      expect(onlyHrefs(accept)).toEqual(['https://example.com'])
    })

    it('runs the controller-level validate when no per-call override is given', () => {
      const decisions = ds({ validate: (u) => u.includes('example.com') })
      expect(decisions.forWrite({ kind: 'href', href: 'https://other.com' })).toEqual([])
      expect(onlyHrefs(decisions.forWrite({ kind: 'href', href: 'https://example.com' }))).toEqual([
        'https://example.com'
      ])
    })

    it('does NOT apply shouldAutoLink to explicit href writes', () => {
      const veto = createURLDecisions({ shouldAutoLink: () => false })
      const out = veto.forWrite({ kind: 'href', href: 'https://example.com' })
      expect(onlyHrefs(out)).toEqual(['https://example.com'])
    })

    it('runs the composed gate (composeGate + isAllowedUri)', () => {
      const decisions = createURLDecisions({
        gate: composeGate({
          isAllowedUri: (uri) => uri.includes('allowed.com'),
          defaultProtocol: 'https'
        })
      })
      expect(decisions.forWrite({ kind: 'href', href: 'https://blocked.com' })).toEqual([])
      expect(onlyHrefs(decisions.forWrite({ kind: 'href', href: 'https://allowed.com' }))).toEqual([
        'https://allowed.com'
      ])
    })

    it('classifies the result type', () => {
      expect(ds().forWrite({ kind: 'href', href: 'https://example.com' })[0].type).toBe('url')
      expect(ds().forWrite({ kind: 'href', href: 'user@example.com' })[0].type).toBe('email')
      expect(ds().forWrite({ kind: 'href', href: '+15551234567' })[0].type).toBe('phone')
      expect(ds().forWrite({ kind: 'href', href: 'whatsapp://send?text=hi' })[0].type).toBe(
        'special'
      )
    })

    it('attaches catalog match for special URLs', () => {
      const out = ds().forWrite({ kind: 'href', href: 'https://github.com/owner/repo' })
      expect(out[0].special?.type).toBe('github')
    })
  })

  describe('forWrite — kind: text (full extraction)', () => {
    it('detects a single URL inside a sentence', () => {
      const out = ds().forWrite({ kind: 'text', text: 'visit https://example.com today' })
      expect(out).toHaveLength(1)
      expect(out[0].href).toBe('https://example.com')
      expect(out[0].start).toBe('visit '.length)
    })

    it('detects multiple links in one input', () => {
      const out = ds().forWrite({
        kind: 'text',
        text: 'see https://a.com and https://b.com'
      })
      expect(onlyHrefs(out).sort()).toEqual(['https://a.com', 'https://b.com'])
    })

    it('detects bare phones in single-token text', () => {
      const out = ds().forWrite({ kind: 'text', text: '+15551234567' })
      expect(out).toHaveLength(1)
      expect(out[0].type).toBe('phone')
      expect(out[0].href).toBe('tel:+15551234567')
    })

    it('returns an empty array when no link is found', () => {
      expect(ds().forWrite({ kind: 'text', text: 'plain prose with no link' })).toEqual([])
    })

    it('applies shouldAutoLink to text input', () => {
      const out = createURLDecisions({
        shouldAutoLink: (uri) => !uri.includes('blocked')
      }).forWrite({ kind: 'text', text: 'https://allowed.com and https://blocked.com' })
      expect(onlyHrefs(out)).toEqual(['https://allowed.com'])
    })

    it('applies the gate to text input', () => {
      const decisions = createURLDecisions({
        gate: composeGate({ isAllowedUri: (u) => !u.includes('blocked.com') })
      })
      const out = decisions.forWrite({
        kind: 'text',
        text: 'https://ok.com https://blocked.com'
      })
      expect(onlyHrefs(out)).toEqual(['https://ok.com'])
    })
  })

  describe('forWrite — kind: match (pre-detected linkify match)', () => {
    it('normalizes the match href and applies the auto-gate stack', () => {
      const out = ds().forWrite({
        kind: 'match',
        match: { type: 'url', value: 'google.com', href: 'http://google.com' }
      })
      expect(onlyHrefs(out)).toEqual(['https://google.com'])
    })

    it('applies shouldAutoLink to match input', () => {
      const out = createURLDecisions({ shouldAutoLink: () => false }).forWrite({
        kind: 'match',
        match: { type: 'url', value: 'example.com', href: 'http://example.com' }
      })
      expect(out).toEqual([])
    })
  })

  describe('detect (pure shape check)', () => {
    it('returns true for text containing a URL', () => {
      expect(ds().detect('visit https://example.com today')).toBe(true)
    })

    it('returns true for a bare phone token', () => {
      expect(ds().detect('+15551234567')).toBe(true)
    })

    it('returns true for a special-scheme URL', () => {
      expect(ds().detect('whatsapp://send?text=hi')).toBe(true)
    })

    it('returns false for plain prose', () => {
      expect(ds().detect('plain prose with no link')).toBe(false)
    })

    it('IGNORES gate / validate / shouldAutoLink — detection only', () => {
      const decisions = createURLDecisions({
        gate: () => false as never,
        validate: () => false,
        shouldAutoLink: () => false
      })
      expect(decisions.detect('https://example.com')).toBe(true)
    })
  })

  describe('forRead', () => {
    it('marks safe + navigable for a plain https URL with the default gate', () => {
      const out = ds().forRead('https://example.com')
      expect(out).toEqual({
        safe: true,
        navigable: true,
        href: 'https://example.com',
        special: null
      })
    })

    it('marks unsafe + non-navigable for dangerous schemes', () => {
      for (const dangerous of [
        'javascript:alert(1)',
        'data:text/html,foo',
        'vbscript:msgbox',
        'file:///etc/passwd',
        'blob:http://example.com/abc'
      ]) {
        const out = ds().forRead(dangerous)
        expect(out.safe).toBe(false)
        expect(out.navigable).toBe(false)
        expect(out.special).toBeNull()
      }
    })

    it('returns empty href and falsy flags for nullish inputs', () => {
      for (const empty of [null, undefined, '']) {
        const out = ds().forRead(empty)
        expect(out).toEqual({ safe: false, navigable: false, href: '', special: null })
      }
    })

    it('respects the composed gate for navigability', () => {
      const decisions = createURLDecisions({
        gate: composeGate({ isAllowedUri: (u) => u.includes('allowed.com') })
      })
      const blocked = decisions.forRead('https://blocked.com')
      expect(blocked.safe).toBe(true)
      expect(blocked.navigable).toBe(false)

      const allowed = decisions.forRead('https://allowed.com')
      expect(allowed.safe).toBe(true)
      expect(allowed.navigable).toBe(true)
    })

    it('attaches catalog match for special URLs', () => {
      const out = ds().forRead('https://github.com/owner/repo')
      expect(out.special?.type).toBe('github')
    })

    it('does NOT attach catalog match for unsafe hrefs (defense-in-depth)', () => {
      const out = ds().forRead('javascript:alert(1)')
      expect(out.special).toBeNull()
    })
  })
})

describe('composeGate', () => {
  it('blocks dangerous schemes regardless of isAllowedUri', () => {
    const gate = composeGate({ isAllowedUri: () => true })
    expect(gate('javascript:alert(1)')).toBe(false)
    expect(gate('data:text/html,foo')).toBe(false)
  })

  it('passes safe schemes when no isAllowedUri is set', () => {
    const gate = composeGate()
    expect(gate('https://example.com')).toBe(true)
  })

  it('threads context to isAllowedUri', () => {
    let receivedCtx: {
      defaultValidate: unknown
      protocols: unknown
      defaultProtocol: string
    } | null = null
    const gate = composeGate({
      isAllowedUri: (uri, ctx) => {
        receivedCtx = ctx
        return uri.includes('ok')
      },
      defaultProtocol: 'http',
      protocols: ['custom']
    })
    expect(gate('https://ok.com')).toBe(true)
    expect(gate('https://blocked.com')).toBe(false)
    expect(receivedCtx).not.toBeNull()
    expect(receivedCtx?.defaultProtocol).toBe('http')
    expect(receivedCtx?.protocols).toEqual(['custom'])
    expect(typeof receivedCtx?.defaultValidate).toBe('function')
  })
})
