/**
 * The token is the whole credential, so these pin the rejection paths. A
 * verifier that accepts a forged token fails silently. Nobody reports it.
 */
import { describe, expect, it } from 'bun:test'

import { oneClickUrl, unsubscribeLinkUrl } from '../../src/lib/email/unsubscribeUrls'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../src/lib/unsubscribeToken'

const SECRET = 'test-secret-not-a-real-one'
const USER = '992bb85e-78f8-4747-981a-fd63d9317ff1'
const NOW = 1_700_000_000

/** Flips one character of a base64url part, keeping the length the same. */
const flip = (part: string, index: number): string =>
  part.slice(0, index) + (part[index] === 'A' ? 'B' : 'A') + part.slice(index + 1)

describe('unsubscribe token', () => {
  it('round-trips the user and the action', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'digest',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(verifyUnsubscribeToken({ token, secret: SECRET, nowSeconds: NOW })).toEqual({
      uid: USER,
      act: 'digest',
      exp: NOW + 90 * 24 * 60 * 60
    })
  })

  it('is safe in a query string without escaping', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'all',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(encodeURIComponent(token)).toBe(token)
  })

  it('rejects a token signed with another secret', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'all',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(
      verifyUnsubscribeToken({ token, secret: 'a-different-secret', nowSeconds: NOW })
    ).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const [payload, signature] = signUnsubscribeToken({
      userId: USER,
      action: 'all',
      secret: SECRET,
      nowSeconds: NOW
    }).split('.') as [string, string]
    expect(
      verifyUnsubscribeToken({
        token: `${payload}.${flip(signature, 0)}`,
        secret: SECRET,
        nowSeconds: NOW
      })
    ).toBeNull()
  })

  // The attack the signature exists to stop: swap in someone else's user id.
  it('rejects a tampered payload', () => {
    const [payload, signature] = signUnsubscribeToken({
      userId: USER,
      action: 'all',
      secret: SECRET,
      nowSeconds: NOW
    }).split('.') as [string, string]
    expect(
      verifyUnsubscribeToken({
        token: `${flip(payload, 12)}.${signature}`,
        secret: SECRET,
        nowSeconds: NOW
      })
    ).toBeNull()
  })

  it('rejects a re-signed payload carrying an unknown action', () => {
    // Forged the way an attacker with the secret would, to prove the action
    // check is not resting on the signature alone.
    const forged = signUnsubscribeToken({
      userId: USER,
      action: 'everything',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(verifyUnsubscribeToken({ token: forged, secret: SECRET, nowSeconds: NOW })).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'mentions',
      secret: SECRET,
      nowSeconds: NOW
    })
    const oneSecondPastExpiry = NOW + 90 * 24 * 60 * 60 + 1
    expect(
      verifyUnsubscribeToken({ token, secret: SECRET, nowSeconds: oneSecondPastExpiry })
    ).toBeNull()
  })

  it('accepts a token on its last valid second', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'mentions',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(
      verifyUnsubscribeToken({ token, secret: SECRET, nowSeconds: NOW + 90 * 24 * 60 * 60 })
    ).not.toBeNull()
  })

  it.each([
    ['no dot', 'notatoken'],
    ['two dots', 'a.b.c'],
    ['empty', ''],
    ['short signature', 'aaa.b']
  ])('rejects a malformed token (%s)', (_label, token) => {
    expect(verifyUnsubscribeToken({ token, secret: SECRET, nowSeconds: NOW })).toBeNull()
  })

  // Fails closed. An unsigned link is worse than a missing one, so this throws
  // rather than returning a token or null that a caller might ship.
  it('throws when the secret is empty', () => {
    expect(() =>
      signUnsubscribeToken({ userId: USER, action: 'all', secret: '', nowSeconds: NOW })
    ).toThrow('EMAIL_UNSUBSCRIBE_SECRET')
    expect(() => verifyUnsubscribeToken({ token: 'a.b', secret: '', nowSeconds: NOW })).toThrow(
      'EMAIL_UNSUBSCRIBE_SECRET'
    )
  })
})

describe('unsubscribe URLs', () => {
  // The reader's link stays on the app domain; the RFC 8058 header must hit the
  // API, because a mail client runs no JavaScript. One route path, written once.
  it('builds the two shapes from one token', () => {
    const token = signUnsubscribeToken({
      userId: USER,
      action: 'replies',
      secret: SECRET,
      nowSeconds: NOW
    })
    expect(unsubscribeLinkUrl('https://docs.plus', token)).toBe(
      `https://docs.plus/unsubscribe?token=${token}`
    )
    expect(oneClickUrl('https://prodback.docs.plus', token)).toBe(
      `https://prodback.docs.plus/api/email/unsubscribe?token=${token}`
    )
  })

  it('signs the action it was asked for', () => {
    for (const action of ['mentions', 'replies', 'reactions', 'digest', 'all'] as const) {
      const token = signUnsubscribeToken({ userId: USER, action, secret: SECRET, nowSeconds: NOW })
      expect(verifyUnsubscribeToken({ token, secret: SECRET, nowSeconds: NOW })?.act).toBe(action)
    }
  })
})
