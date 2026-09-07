import type { HistoryItem } from '@types'

import { pickCompareBaseSince } from './pickCompareBaseSince'

const v = (version: number, createdAt: string): HistoryItem => ({ version, createdAt })

const list = [
  v(18, '2026-09-07T12:00:00.000Z'),
  v(17, '2026-09-07T11:00:00.000Z'),
  v(16, '2026-09-06T10:00:00.000Z')
]

describe('pickCompareBaseSince', () => {
  it('picks the row older than the newest snapshot at or before since', () => {
    expect(pickCompareBaseSince(list, '2026-09-07T11:30:00.000Z')?.version).toBe(16)
  })

  it('picks the previous row when since is after the head', () => {
    expect(pickCompareBaseSince(list, '2026-09-07T12:30:00.000Z')?.version).toBe(17)
  })

  it('picks the oldest row when every snapshot is newer than since', () => {
    expect(pickCompareBaseSince(list, '2026-09-05T00:00:00.000Z')?.version).toBe(16)
  })

  it('returns null when the oldest row is the newest at or before since', () => {
    expect(pickCompareBaseSince(list, '2026-09-06T10:00:00.000Z')).toBeNull()
  })

  it('returns null when there is only one version', () => {
    expect(pickCompareBaseSince([list[0]!], '2026-09-07T11:30:00.000Z')).toBeNull()
  })

  it('returns null when since is not a date', () => {
    expect(pickCompareBaseSince(list, 'not-a-date')).toBeNull()
  })
})
