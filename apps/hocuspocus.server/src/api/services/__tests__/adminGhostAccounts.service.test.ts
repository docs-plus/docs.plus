import { describe, expect, test } from 'bun:test'

import type {
  AccountStore,
  AuthUser,
  GhostDeletionImpact,
  SoftDeleteOutcome,
  UnfinishedErasure
} from '../adminGhostAccounts.service'
import {
  eraseAccounts,
  erasureFailureText,
  isUnfinishedErasure
} from '../adminGhostAccounts.service'

const OLD = '2020-01-01T00:00:00.000Z'
// An unconfirmed email sign-up: a ghost at any age.
const ghostUser = (id: string): AuthUser => ({ id, created_at: OLD, app_metadata: {} })
// Confirmed and signed in: never a ghost.
const activeUser = (id: string): AuthUser => ({
  id,
  created_at: OLD,
  email_confirmed_at: OLD,
  last_sign_in_at: OLD,
  app_metadata: { provider: 'email' }
})

type Seed = {
  users?: AuthUser[]
  admins?: string[]
  impacts?: Record<string, GhostDeletionImpact>
  owned?: Record<string, number>
  soft?: Record<string, SoftDeleteOutcome>
  faults?: Partial<Record<keyof AccountStore, unknown>>
}

// The second adapter: in memory, with a journal of every call and a fault per method.
function fakeStore(seed: Seed = {}) {
  const calls: [keyof AccountStore, unknown][] = []
  const step = (method: keyof AccountStore, arg: unknown) => {
    calls.push([method, arg])
    if (seed.faults && method in seed.faults) throw seed.faults[method]
  }
  const store: AccountStore = {
    async readAuthUser(id) {
      step('readAuthUser', id)
      return seed.users?.find((u) => u.id === id) ?? null
    },
    async isAdmin(id) {
      step('isAdmin', id)
      return seed.admins?.includes(id) ?? false
    },
    async readImpact(id) {
      step('readImpact', id)
      return seed.impacts?.[id] ?? {}
    },
    async ownedDocumentCounts(ids) {
      step('ownedDocumentCounts', ids)
      return new Map(Object.entries(seed.owned ?? {}).filter(([id]) => ids.includes(id)))
    },
    async softDelete(ids) {
      step('softDelete', ids)
      return ids.map((id) => seed.soft?.[id] ?? { id, status: 'ok' })
    },
    async hardDelete(id) {
      step('hardDelete', id)
    }
  }
  const called = (method: keyof AccountStore) => calls.filter(([m]) => m === method)
  return { store, calls, called }
}

const WRITES: (keyof AccountStore)[] = ['softDelete', 'hardDelete']

describe('eraseAccounts — owner request', () => {
  test('soft-deletes an active account and never reads impact, counts or hard-deletes', async () => {
    const { store, called } = fakeStore({ users: [activeUser('a')] })
    expect(await eraseAccounts(store, 'owner_request', ['a'])).toEqual([
      { id: 'a', status: 'soft_deleted', reason: undefined }
    ])
    expect(called('softDelete')).toEqual([['softDelete', ['a']]])
    expect(called('readImpact')).toEqual([])
    expect(called('ownedDocumentCounts')).toEqual([])
    expect(called('hardDelete')).toEqual([])
  })

  test('refuses an unknown id and an admin, and writes nothing', async () => {
    const { store, called } = fakeStore({ users: [activeUser('admin')], admins: ['admin'] })
    expect(await eraseAccounts(store, 'owner_request', ['gone', 'admin'])).toEqual([
      { id: 'gone', status: 'refused', reason: 'User not found' },
      { id: 'admin', status: 'refused', reason: 'User is an admin' }
    ])
    for (const m of WRITES) expect(called(m)).toEqual([])
  })
})

describe('eraseAccounts — ghost gate (#412)', () => {
  test('refuses an unknown id, a non-ghost and an admin, and writes nothing', async () => {
    const { store, called } = fakeStore({
      users: [activeUser('active'), ghostUser('admin')],
      admins: ['admin']
    })
    expect(await eraseAccounts(store, 'ghost', ['gone', 'active', 'admin'])).toEqual([
      { id: 'gone', status: 'refused', reason: 'User not found' },
      { id: 'active', status: 'refused', reason: 'User is no longer a ghost account' },
      { id: 'admin', status: 'refused', reason: 'User is an admin' }
    ])
    expect(called('isAdmin').map(([, id]) => id)).toEqual(['admin'])
    expect(called('readImpact')).toEqual([])
    expect(called('ownedDocumentCounts')).toEqual([])
    for (const m of WRITES) expect(called(m)).toEqual([])
  })

  test('a gate read fault is a failure carrying the thrown value, never a refusal', async () => {
    const fault = { message: 'admin read down' }
    const { store, called } = fakeStore({ users: [ghostUser('g')], faults: { isAdmin: fault } })
    const [o] = await eraseAccounts(store, 'ghost', ['g'])
    expect(o).toEqual({ id: 'g', status: 'failed', error: fault })
    expect(isUnfinishedErasure(o)).toBe(true)
    expect(erasureFailureText(o as UnfinishedErasure)).toBe('Unknown error')
    for (const m of WRITES) expect(called(m)).toEqual([])
  })

  test('every store call sees the lowercased id', async () => {
    const id = 'ABCDEF00-0000-4000-8000-00000000000A'
    const lower = id.toLowerCase()
    const { store, calls } = fakeStore({ users: [ghostUser(lower)] })
    expect(await eraseAccounts(store, 'ghost', [id])).toEqual([
      { id: lower, status: 'hard_deleted' }
    ])
    for (const [, arg] of calls) expect([arg].flat()).toEqual([lower])
  })
})

describe('eraseAccounts — ghost soft or hard', () => {
  test('an owner of live documents is soft-deleted, ahead of the message reason', async () => {
    const { store } = fakeStore({
      users: [ghostUser('o')],
      owned: { o: 2 },
      impacts: { o: { has_blocking_messages: true, message_count: 9 } }
    })
    expect(await eraseAccounts(store, 'ghost', ['o'])).toEqual([
      {
        id: 'o',
        status: 'soft_deleted',
        reason: 'User owns 2 document(s) — soft-deleted + banned so they keep an owner'
      }
    ])
  })

  test('blocking messages give a soft delete; nothing blocking gives a hard delete', async () => {
    const { store, called } = fakeStore({
      users: [ghostUser('m'), ghostUser('h')],
      impacts: { m: { has_blocking_messages: true, message_count: 3 } }
    })
    expect(await eraseAccounts(store, 'ghost', ['m', 'h'])).toEqual([
      {
        id: 'm',
        status: 'soft_deleted',
        reason: 'User has 3 messages — soft-deleted + banned to preserve history'
      },
      { id: 'h', status: 'hard_deleted' }
    ])
    expect(called('hardDelete')).toEqual([['hardDelete', 'h']])
  })

  test('a count fault rejects the call before any write', async () => {
    const { store, called } = fakeStore({
      users: [ghostUser('g')],
      faults: { ownedDocumentCounts: new Error('db down') }
    })
    await expect(eraseAccounts(store, 'ghost', ['g'])).rejects.toThrow('db down')
    for (const m of WRITES) expect(called(m)).toEqual([])
  })
})

describe('eraseAccounts — batch outcomes', () => {
  test('refusals and faults first, then soft, then hard; duplicates kept; one count of all ids', async () => {
    const { store, called } = fakeStore({
      users: [ghostUser('h'), ghostUser('s'), ghostUser('f')],
      owned: { s: 1 }
    })
    // `f` fails its impact read only.
    const readImpact = store.readImpact.bind(store)
    store.readImpact = async (id) => {
      if (id === 'f') throw new Error('rpc down')
      return readImpact(id)
    }
    const outcomes = await eraseAccounts(store, 'ghost', ['h', 'gone', 's', 'f', 'h'], {
      batch: true
    })
    expect(outcomes.map((o) => `${o.id}:${o.status}`)).toEqual([
      'gone:refused',
      'f:failed',
      's:soft_deleted',
      'h:hard_deleted',
      'h:hard_deleted'
    ])
    expect(called('ownedDocumentCounts')).toEqual([
      ['ownedDocumentCounts', ['h', 'gone', 's', 'f', 'h']]
    ])
    expect(outcomes.filter(isUnfinishedErasure).map(erasureFailureText)).toEqual([
      'User not found',
      'rpc down'
    ])
  })

  // The bulk route always counted, so a count fault there answers 500 even with none admitted.
  test('a batch count fault rejects even when every id is refused', async () => {
    const { store, called } = fakeStore({ faults: { ownedDocumentCounts: new Error('db down') } })
    await expect(eraseAccounts(store, 'ghost', ['gone'], { batch: true })).rejects.toThrow(
      'db down'
    )
    for (const m of WRITES) expect(called(m)).toEqual([])
  })

  test('soft-delete results map to failed and incomplete with their texts', async () => {
    const { store } = fakeStore({
      users: [ghostUser('x'), ghostUser('y')],
      owned: { x: 1, y: 1 },
      soft: {
        x: { id: 'x', status: 'failed', error: 'row clear failed' },
        y: { id: 'y', status: 'incomplete', steps: ['ban', 'queued email removal'] }
      }
    })
    const failures = (await eraseAccounts(store, 'ghost', ['x', 'y'], { batch: true })).filter(
      isUnfinishedErasure
    )
    expect(failures.map(erasureFailureText)).toEqual([
      'row clear failed',
      'ban and queued email removal failed'
    ])
  })

  test('a hard-delete fault fails that id only', async () => {
    const { store } = fakeStore({ users: [ghostUser('a'), ghostUser('b')] })
    store.hardDelete = async (id) => {
      if (id === 'a') throw new Error('auth down')
    }
    const outcomes = await eraseAccounts(store, 'ghost', ['a', 'b'], { batch: true })
    expect(outcomes.map((o) => `${o.id}:${o.status}`)).toEqual(['a:failed', 'b:hard_deleted'])
  })
})
