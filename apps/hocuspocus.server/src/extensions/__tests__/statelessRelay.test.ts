import { describe, expect, test } from 'bun:test'

import { decideStatelessRelay, MAX_STATELESS_RELAY_BYTES } from '../statelessRelay'

describe('decideStatelessRelay', () => {
  test('relays the one envelope a shipped client originates', () => {
    expect(decideStatelessRelay({ type: 'docTitle', title: 'Hello' }).relay).toBe(true)
  })

  test('refuses an envelope carrying msg, even with an allowed type', () => {
    // The webapp reads `msg` before `type`, so a type-only guard let
    // `{type:'docTitle', msg:'document:saved'}` flip every viewer to "Saved"
    // while their edits were still unpersisted.
    expect(decideStatelessRelay({ type: 'docTitle', msg: 'document:saved' })).toEqual({
      relay: false,
      reason: 'type-not-allowed'
    })
  })

  test('refuses a type nobody allowed', () => {
    // `{type:'private'}` drove every viewer through the sealed-document redirect.
    expect(decideStatelessRelay({ type: 'private' }).relay).toBe(false)
  })

  test('refuses a payload over the byte budget', () => {
    expect(
      decideStatelessRelay({ type: 'docTitle', title: 'x'.repeat(MAX_STATELESS_RELAY_BYTES + 1) })
    ).toMatchObject({ relay: false, reason: 'oversized' })
  })

  test('checks the type before serialising, so an oversized forgery reads as a forgery', () => {
    expect(
      decideStatelessRelay({ type: 'private', pad: 'x'.repeat(MAX_STATELESS_RELAY_BYTES + 1) })
    ).toEqual({ relay: false, reason: 'type-not-allowed' })
  })
})
