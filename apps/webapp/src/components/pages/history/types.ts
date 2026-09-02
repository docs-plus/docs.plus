import type { Decoration } from '@tiptap/pm/view'
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

export type CompareDecorationsResult = { decorations: Decoration[] } | { error: 'undecodable' }

export type AuthorRosterRow = {
  /** A userId, or the literal `anonymous` / `unrecorded`. */
  key: string
  kind: 'user' | 'anonymous' | 'unrecorded'
  userId?: string
  count: number
}

export type AuthorRoster = {
  rows: AuthorRosterRow[]
  blockIndicesByKey: Map<string, number[]>
  /** Per block, the keys whose text sits in it. Empty means no binding. */
  blockKeys: string[][]
  /** Blocks holding at least one bound clientID. Per-person counts sum above this. */
  knownCount: number
  totalCount: number
}

export type HistoryAuthorship =
  | { status: 'pending' }
  | { status: 'unaligned' }
  | { status: 'ready'; roster: AuthorRoster; types: string[] }

export type HistorySidebarRowHandlers = {
  activeVersion: number
  latestVersion: number
  openDays: ReadonlySet<string>
  onToggleDay: (dayKey: string) => void
  onToggleSession: (sessionId: string) => void
  onSelectVersion: (version: number) => void
  /** Compare picker: hide copy-link and block the viewed version. */
  comparePick?: boolean
}
