import { sessionContainsVersion } from '../helpers'
import type { GroupedByDay, SidebarRow } from '../types'

export function buildHistorySidebarRows(
  groupedByDay: GroupedByDay,
  openDays: ReadonlySet<string>,
  expandedSessions: ReadonlySet<string>
): SidebarRow[] {
  const rows: SidebarRow[] = []

  for (const [dayLabel, sessions] of Object.entries(groupedByDay)) {
    rows.push({ kind: 'day-header', dayKey: dayLabel, label: dayLabel })
    if (!openDays.has(dayLabel)) continue

    for (const session of sessions) {
      if (session.versions.length === 1) {
        rows.push({ kind: 'single-version', session, version: session.versions[0] })
        continue
      }

      rows.push({
        kind: 'session',
        session,
        expanded: expandedSessions.has(session.id)
      })
    }
  }

  return rows
}

export function findActiveVersionRowIndex(rows: SidebarRow[], activeVersion: number): number {
  return rows.findIndex((row) => {
    if (row.kind === 'single-version') return row.version.version === activeVersion
    if (row.kind === 'session') return sessionContainsVersion(row.session, activeVersion)
    return false
  })
}

export function sidebarRowKey(row: SidebarRow, index: number): string {
  switch (row.kind) {
    case 'day-header':
      return `day-${row.dayKey}`
    case 'single-version':
      return `single-${row.version.version}`
    case 'session':
      return `session-${row.session.id}-${row.expanded ? 'open' : 'closed'}`
    default: {
      const _exhaustive: never = row
      return `row-${index}`
    }
  }
}
