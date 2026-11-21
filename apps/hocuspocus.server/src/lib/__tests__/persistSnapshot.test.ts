import { describe, expect, test } from 'bun:test'

import { isUnchangedSave, type SaveFacts, unionContributors } from '../persistSnapshot'

// The row-level cases (the lock, the guard, a real merge) need Postgres. They live in
// scripts/e2e-persist-snapshot.ts. These pin the decision the worker makes from them.
const bytes = Buffer.from([1, 2, 3])
const head = {
  data: new Uint8Array(bytes),
  commitMessage: '',
  trigger: 'websocket',
  hasOlder: true
}
const save: SaveFacts = {
  skipUnchanged: true,
  trigger: 'websocket',
  commitMessage: '',
  forced: false
}

describe('isUnchangedSave', () => {
  test('keeps the head for an unnamed websocket save with the same bytes', () => {
    expect(isUnchangedSave(save, head, Buffer.from(bytes))).toBe(true)
  })

  test('inserts when one byte differs', () => {
    expect(isUnchangedSave(save, head, Buffer.from([1, 2, 4]))).toBe(false)
  })

  test.each(['api', 'mcp', 'checkpoint', 'revert', 'revert-backup', 'schema-migration', null])(
    'never skips a %p save',
    (trigger) => {
      expect(isUnchangedSave({ ...save, trigger }, head, Buffer.from(bytes))).toBe(false)
    }
  )

  test('never skips a named or a forced save', () => {
    expect(isUnchangedSave({ ...save, commitMessage: 'v1' }, head, Buffer.from(bytes))).toBe(false)
    expect(isUnchangedSave({ ...save, forced: true }, head, Buffer.from(bytes))).toBe(false)
  })

  test('never skips onto a named, machine or first head, or with the flag off', () => {
    const merged = Buffer.from(bytes)
    expect(isUnchangedSave(save, { ...head, commitMessage: 'Restored version 3' }, merged)).toBe(
      false
    )
    expect(isUnchangedSave(save, { ...head, trigger: 'schema-migration' }, merged)).toBe(false)
    expect(isUnchangedSave(save, { ...head, hasOlder: false }, merged)).toBe(false)
    expect(isUnchangedSave(save, null, merged)).toBe(false)
    expect(isUnchangedSave({ ...save, skipUnchanged: false }, head, merged)).toBe(false)
  })
})

describe('unionContributors', () => {
  test('keeps first-seen order and drops duplicates on both sides', () => {
    expect(
      unionContributors(['alice', 'bob', 'alice'], ['bob', 'carol', 'alice', 'carol'])
    ).toEqual(['alice', 'bob', 'carol'])
  })
})
