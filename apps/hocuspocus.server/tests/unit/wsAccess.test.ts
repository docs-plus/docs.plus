import { describe, expect, test } from 'bun:test'

import { resolveWsAccess } from '../../src/lib/wsAccess'

describe('resolveWsAccess', () => {
  const owner = { sub: 'owner-1', is_anonymous: false }
  const nonOwner = { sub: 'other-1', is_anonymous: false }
  const anon = { sub: 'anon-1', is_anonymous: true }
  const live = { deleted: false as const }

  test('public doc allows anyone, including no user', () => {
    expect(
      resolveWsAccess({
        isPrivate: false,
        ownerId: 'owner-1',
        user: null,
        lookupFailed: false,
        ...live
      })
    ).toBe('allow')
    expect(
      resolveWsAccess({
        isPrivate: false,
        ownerId: null,
        user: anon,
        lookupFailed: false,
        ...live
      })
    ).toBe('allow')
  })

  test('private doc denies anonymous and no-user', () => {
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: 'owner-1',
        user: null,
        lookupFailed: false,
        ...live
      })
    ).toBe('deny')
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: 'owner-1',
        user: anon,
        lookupFailed: false,
        ...live
      })
    ).toBe('deny')
  })

  test('private doc allows the owner, denies a signed-in non-owner', () => {
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: 'owner-1',
        user: owner,
        lookupFailed: false,
        ...live
      })
    ).toBe('allow')
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: 'owner-1',
        user: nonOwner,
        lookupFailed: false,
        ...live
      })
    ).toBe('deny')
  })

  test('private ownerless doc denies even a signed-in user (sign-in wall until backfill)', () => {
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: null,
        user: owner,
        lookupFailed: false,
        ...live
      })
    ).toBe('deny')
  })

  test('lookup failure denies ahead of the public fast-path (fail closed)', () => {
    // A public doc + owner would otherwise allow; lookupFailed must short-circuit to deny.
    expect(
      resolveWsAccess({
        isPrivate: false,
        ownerId: 'owner-1',
        user: owner,
        lookupFailed: true,
        ...live
      })
    ).toBe('deny')
    expect(
      resolveWsAccess({
        isPrivate: true,
        ownerId: 'owner-1',
        user: owner,
        lookupFailed: true,
        ...live
      })
    ).toBe('deny')
  })

  test('soft-deleted docs deny even the owner on a public document', () => {
    expect(
      resolveWsAccess({
        isPrivate: false,
        ownerId: 'owner-1',
        user: owner,
        lookupFailed: false,
        deleted: true
      })
    ).toBe('deny')
  })
})
