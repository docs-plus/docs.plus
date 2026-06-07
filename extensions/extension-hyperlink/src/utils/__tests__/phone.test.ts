import { describe, expect, it } from 'bun:test'

import { isBarePhone } from '../phone'

/**
 * Pins the strict E.164 contract of `isBarePhone`. The helper is a
 * security-relevant gate: every false positive becomes an autolinked
 * `tel:` href, so the asymmetry "more rejections than accepts" is by
 * design. Cases below cover the boundary digit-counts and every
 * permitted formatting pattern.
 */
describe('isBarePhone', () => {
  describe('accepts E.164 numbers (digits only)', () => {
    // Boundary cases (8 / 15 digits) live in the dedicated `boundary
    // lengths` describe below to avoid duplicating assertions.
    for (const [input, expectedHref] of [
      ['+4733378901', 'tel:+4733378901'], // Norwegian mobile (10 digits)
      ['+15551234567', 'tel:+15551234567'], // US (11 digits)
      ['+442079460958', 'tel:+442079460958'], // UK (12 digits)
      ['+861380013800', 'tel:+861380013800'] // CN (12 digits)
    ]) {
      it(`${input} → ${expectedHref}`, () => {
        expect(isBarePhone(input)).toEqual({ ok: true, href: expectedHref })
      })
    }
  })

  describe('strips formatting characters from the canonical href', () => {
    // Per RFC 3966, the global `tel:` form is `tel:+E.164` (digits
    // only after the `+`). The display text in the document keeps the
    // user's typed formatting; only the href is canonicalized.
    for (const [input, expectedHref] of [
      ['+1 (555) 123-4567', 'tel:+15551234567'],
      ['+1-555-123-4567', 'tel:+15551234567'],
      ['+1.555.123.4567', 'tel:+15551234567'],
      ['+44 20 7946 0958', 'tel:+442079460958'],
      ['+1 555 123 4567', 'tel:+15551234567']
    ]) {
      it(`${input} → ${expectedHref}`, () => {
        expect(isBarePhone(input)).toEqual({ ok: true, href: expectedHref })
      })
    }
  })

  describe('rejects shapes that are not phone numbers', () => {
    for (const input of [
      '', // empty
      '   ', // whitespace
      '4733378901', // missing leading +
      '+', // bare plus
      '+1', // 1 digit (too short)
      '+1234567', // 7 digits (one short of E.164 floor)
      '+1234567890123456', // 16 digits (one over E.164 ceiling)
      '+abc', // letters
      '+1abc234', // letters interleaved
      '+15a5512345', // letter inside otherwise-valid number
      '+1@example.com', // shape pollution
      '2024', // year
      '5551234567', // bare US digits
      'mailto:hi@example.com', // unrelated scheme
      'https://example.com', // URL
      ' +4733378901', // leading whitespace (caller must trim)
      '+4733378901 ' // trailing whitespace (caller must trim)
    ]) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(isBarePhone(input).ok).toBe(false)
      })
    }
  })

  describe('boundary lengths', () => {
    // The 7-digit boundary is the most likely place for a future
    // refactor to drift; pin both sides.
    it('rejects exactly 7 digits', () => {
      expect(isBarePhone('+1234567').ok).toBe(false)
    })

    it('accepts exactly 8 digits', () => {
      expect(isBarePhone('+12345678').ok).toBe(true)
    })

    it('accepts exactly 15 digits', () => {
      expect(isBarePhone('+123456789012345').ok).toBe(true)
    })

    it('rejects exactly 16 digits', () => {
      expect(isBarePhone('+1234567890123456').ok).toBe(false)
    })
  })
})
