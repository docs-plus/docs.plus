import type { HistoryItem } from '@types'

export const HISTORY_SIDEBAR_VIRTUALIZE_THRESHOLD = 80

/** `#history` read-only host: `useStore((s) => s.editor)`. Pad collab: `settings.editor.instance`. */

export interface VersionSession {
  id: string
  versions: HistoryItem[]
  startTime: Date
  endTime: Date
  isLatest: boolean
}

export type GroupedByDay = Record<string, VersionSession[]>

export type SidebarRow =
  | { kind: 'day-header'; dayKey: string; label: string }
  | { kind: 'single-version'; session: VersionSession; version: HistoryItem }
  | { kind: 'session'; session: VersionSession; expanded: boolean }

export type HistorySidebarRowHandlers = {
  activeVersion: number
  latestVersion: number
  openDays: ReadonlySet<string>
  onToggleDay: (dayKey: string) => void
  onToggleSession: (sessionId: string) => void
  onSelectVersion: (version: number) => void
}
