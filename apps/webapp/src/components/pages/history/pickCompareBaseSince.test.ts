import type { HistoryItem } from '@types'

import { compareBaseSinceMessage, pickCompareBaseSince } from './pickCompareBaseSince'

const v = (version: number, createdAt: string): HistoryItem => ({ version, createdAt })

// Every fixture is `version desc`, the order `history.list` really ships.
const list = [
  v(18, '2026-09-07T12:00:00.000Z'),
  v(17, '2026-09-07T11:00:00.000Z'),
  v(16, '2026-09-06T10:00:00.000Z')
]

// v19 was committed out of order: it holds the second-newest version but the
// oldest instant of the three recent rows.
const outOfOrder = [
  v(20, '2026-09-07T10:00:00.000Z'),
  v(19, '2026-09-07T14:00:00.000Z'),
  v(18, '2026-09-07T11:00:00.000Z'),
  v(17, '2026-09-07T09:00:00.000Z')
]

describe('pickCompareBaseSince', () => {
  it('picks the newest snapshot at or before since', () => {
    expect(pickCompareBaseSince(list, '2026-09-07T11:30:00.000Z')).toEqual({
      kind: 'base',
      item: v(17, '2026-09-07T11:00:00.000Z')
    })
  })

  it('never picks a snapshot saved after since when the two orders disagree', () => {
    expect(pickCompareBaseSince(outOfOrder, '2026-09-07T12:00:00.000Z')).toEqual({
      kind: 'base',
      item: v(18, '2026-09-07T11:00:00.000Z')
    })
  })

  it('breaks a createdAt tie on the higher version', () => {
    const tied = [
      v(18, '2026-09-07T12:00:00.000Z'),
      v(17, '2026-09-07T11:00:00.000Z'),
      v(16, '2026-09-07T11:00:00.000Z')
    ]
    expect(pickCompareBaseSince(tied, '2026-09-07T11:30:00.000Z')).toEqual({
      kind: 'base',
      item: v(17, '2026-09-07T11:00:00.000Z')
    })
  })

  it('falls back to the oldest row when every snapshot is newer than since', () => {
    expect(pickCompareBaseSince(list, '2026-09-05T00:00:00.000Z')).toEqual({
      kind: 'base',
      item: v(16, '2026-09-06T10:00:00.000Z')
    })
  })

  it('finds the oldest row by createdAt, not by list position', () => {
    const unordered = [
      v(20, '2026-09-07T14:00:00.000Z'),
      v(19, '2026-09-07T09:00:00.000Z'),
      v(18, '2026-09-07T11:00:00.000Z'),
      v(17, '2026-09-07T10:00:00.000Z')
    ]
    expect(pickCompareBaseSince(unordered, '2026-09-06T00:00:00.000Z')).toEqual({
      kind: 'base',
      item: v(19, '2026-09-07T09:00:00.000Z')
    })
  })

  // The other end of the search, so the tie runs the other way: the lower
  // version is the row further back, and diffing against the later one would
  // hide whatever happened between the two.
  it('breaks a tie on the oldest row toward the lower version', () => {
    const tiedOldest = [
      v(20, '2026-09-07T14:00:00.000Z'),
      v(19, '2026-09-07T09:00:00.000Z'),
      v(18, '2026-09-07T09:00:00.000Z')
    ]
    expect(pickCompareBaseSince(tiedOldest, '2026-09-06T00:00:00.000Z')).toEqual({
      kind: 'base',
      item: v(18, '2026-09-07T09:00:00.000Z')
    })
  })

  it('reports nothing changed when the head is the base and no row is newer', () => {
    const picked = pickCompareBaseSince(list, '2026-09-07T12:30:00.000Z')
    expect(picked.kind).toBe('unchanged')
    expect(compareBaseSinceMessage(picked)).toBe('Nothing changed since you left.')
  })

  it('reports a pruned baseline when the only row is newer than since', () => {
    const picked = pickCompareBaseSince([list[0]!], '2026-09-07T11:30:00.000Z')
    expect(picked.kind).toBe('baseline-pruned')
    expect(compareBaseSinceMessage(picked)).toBe('No earlier version to compare against.')
  })

  it('says nothing when since is not a date', () => {
    const picked = pickCompareBaseSince(list, 'not-a-date')
    expect(picked.kind).toBe('unavailable')
    expect(compareBaseSinceMessage(picked)).toBeNull()
  })

  it('says nothing when the list is empty', () => {
    const picked = pickCompareBaseSince([], '2026-09-07T11:30:00.000Z')
    expect(picked.kind).toBe('unavailable')
    expect(compareBaseSinceMessage(picked)).toBeNull()
  })
})
