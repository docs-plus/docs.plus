import { describe, expect, test } from 'bun:test'

import { isPadTitleChange } from '../padTitleChange'

describe('isPadTitleChange', () => {
  test('skips when this PUT creates the row', () => {
    expect(isPadTitleChange({ existed: false, storedTitle: undefined, nextTitle: 'Notes' })).toBe(
      false
    )
  })

  test('skips when title is not in the PUT', () => {
    expect(isPadTitleChange({ existed: true, storedTitle: 'Notes', nextTitle: undefined })).toBe(
      false
    )
  })

  test('skips when the new Pad title is empty', () => {
    expect(isPadTitleChange({ existed: true, storedTitle: 'Notes', nextTitle: '' })).toBe(false)
  })

  test('skips when the new Pad title equals the stored one', () => {
    expect(isPadTitleChange({ existed: true, storedTitle: 'Notes', nextTitle: 'Notes' })).toBe(
      false
    )
  })

  test('treats a null stored title as empty', () => {
    expect(isPadTitleChange({ existed: true, storedTitle: null, nextTitle: 'Notes' })).toBe(true)
    expect(isPadTitleChange({ existed: true, storedTitle: null, nextTitle: '' })).toBe(false)
  })

  test('fires when an existing row is renamed', () => {
    expect(isPadTitleChange({ existed: true, storedTitle: 'Old', nextTitle: 'New' })).toBe(true)
  })
})
