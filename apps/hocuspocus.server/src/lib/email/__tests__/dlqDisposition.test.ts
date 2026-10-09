import { describe, expect, test } from 'bun:test'

import { judgeEmailDlqEntry } from '../dlqDisposition'

const NOW = Date.parse('2026-10-09T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(NOW - hours * 60 * 60 * 1000).toISOString()

describe('judgeEmailDlqEntry', () => {
  test('replays an operator entry, whatever its age', () => {
    expect(judgeEmailDlqEntry({ failureKind: 'operator', failedAt: hoursAgo(72) }, NOW)).toBe(
      'replay'
    )
  })

  test('discards a permanent entry', () => {
    expect(judgeEmailDlqEntry({ failureKind: 'permanent', failedAt: hoursAgo(1) }, NOW)).toBe(
      'discard'
    )
  })

  test('replays a transient entry inside the key window, and not after it', () => {
    expect(judgeEmailDlqEntry({ failureKind: 'transient', failedAt: hoursAgo(23) }, NOW)).toBe(
      'replay'
    )
    expect(judgeEmailDlqEntry({ failureKind: 'transient', failedAt: hoursAgo(25) }, NOW)).toBe(
      'unresolved'
    )
  })

  test('leaves a transient entry with no readable time unresolved', () => {
    expect(judgeEmailDlqEntry({ failureKind: 'transient', failedAt: 'not a date' }, NOW)).toBe(
      'unresolved'
    )
  })

  test('leaves an entry written before failures were typed unresolved', () => {
    expect(judgeEmailDlqEntry({ failedAt: hoursAgo(1) }, NOW)).toBe('unresolved')
  })
})
