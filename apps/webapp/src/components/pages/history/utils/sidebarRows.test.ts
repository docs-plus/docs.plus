import type { HistoryItem } from '@types'

import { groupSessionsByDay } from '../helpers'
import type { GroupedByDay } from '../types'
import { buildHistorySidebarRows, findActiveVersionRowIndex } from './sidebarRows'

function makeVersion(n: number, minutesAgo: number): HistoryItem {
  const createdAt = new Date(Date.now() - minutesAgo * 60_000).toISOString()
  return { version: n, createdAt, commitMessage: n % 5 === 0 ? `Commit ${n}` : undefined }
}

function makeGroupedFixture(versionCount: number): GroupedByDay {
  const list = Array.from({ length: versionCount }, (_, i) => makeVersion(versionCount - i, i * 3))
  return groupSessionsByDay(list)
}

describe('buildHistorySidebarRows', () => {
  it('emits only day headers when all days are collapsed', () => {
    const grouped = makeGroupedFixture(5)
    const dayKeys = Object.keys(grouped)
    const rows = buildHistorySidebarRows(grouped, new Set(), new Set())

    expect(rows).toHaveLength(dayKeys.length)
    expect(rows.every((row) => row.kind === 'day-header')).toBe(true)
  })

  it('opens a day and lists single-version sessions', () => {
    const grouped = makeGroupedFixture(3)
    const dayLabel = Object.keys(grouped)[0]
    const rows = buildHistorySidebarRows(grouped, new Set([dayLabel]), new Set())

    expect(rows.some((row) => row.kind === 'single-version')).toBe(true)
    expect(rows.filter((row) => row.kind === 'day-header')).toHaveLength(
      Object.keys(grouped).length
    )
  })

  it('marks a multi-version session expanded when its id is in expandedSessions', () => {
    const list: HistoryItem[] = [makeVersion(3, 1), makeVersion(2, 2), makeVersion(1, 3)]
    const grouped = groupSessionsByDay(list)
    const dayLabel = Object.keys(grouped)[0]
    const sessionId = grouped[dayLabel][0].id

    const rows = buildHistorySidebarRows(grouped, new Set([dayLabel]), new Set([sessionId]))
    const sessionRow = rows.find((row) => row.kind === 'session')

    expect(sessionRow).toBeDefined()
    if (sessionRow?.kind === 'session') {
      expect(sessionRow.expanded).toBe(true)
      expect(sessionRow.session.versions).toHaveLength(3)
    }
  })

  it('marks a multi-version session collapsed when not in expandedSessions', () => {
    const list: HistoryItem[] = [makeVersion(3, 1), makeVersion(2, 2), makeVersion(1, 3)]
    const grouped = groupSessionsByDay(list)
    const dayLabel = Object.keys(grouped)[0]

    const rows = buildHistorySidebarRows(grouped, new Set([dayLabel]), new Set())
    const sessionRow = rows.find((row) => row.kind === 'session')

    expect(sessionRow).toBeDefined()
    if (sessionRow?.kind === 'session') {
      expect(sessionRow.expanded).toBe(false)
    }
  })
})

describe('findActiveVersionRowIndex', () => {
  it('finds a single-version row by version number', () => {
    const grouped = makeGroupedFixture(4)
    const dayLabel = Object.keys(grouped)[0]
    const rows = buildHistorySidebarRows(grouped, new Set([dayLabel]), new Set())
    const target = grouped[dayLabel].flatMap((s) => s.versions)[0].version

    expect(findActiveVersionRowIndex(rows, target)).toBeGreaterThanOrEqual(0)
  })

  it('finds a session row containing the active version', () => {
    const list: HistoryItem[] = [makeVersion(3, 1), makeVersion(2, 2), makeVersion(1, 3)]
    const grouped = groupSessionsByDay(list)
    const dayLabel = Object.keys(grouped)[0]
    const sessionId = grouped[dayLabel][0].id
    const rows = buildHistorySidebarRows(grouped, new Set([dayLabel]), new Set([sessionId]))

    expect(findActiveVersionRowIndex(rows, 2)).toBeGreaterThanOrEqual(0)
  })

  it('returns -1 when the active version is in a collapsed day', () => {
    const grouped = makeGroupedFixture(6)
    const rows = buildHistorySidebarRows(grouped, new Set(), new Set())
    const anyVersion = Object.values(grouped)[0][0].versions[0].version

    expect(findActiveVersionRowIndex(rows, anyVersion)).toBe(-1)
  })
})
