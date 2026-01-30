import { ProsemirrorTransformer } from '@hocuspocus/transformer'
import { HistoryItem } from '@types'
import * as Y from 'yjs'

// Session = group of versions saved within SESSION_GAP_MS of each other
const SESSION_GAP_MS = 2 * 60 * 1000 // 2 minutes

export interface VersionSession {
  id: string
  versions: HistoryItem[]
  startTime: Date
  endTime: Date
  isLatest: boolean
}

interface GroupedByDay {
  [date: string]: VersionSession[]
}

export const getContentFromYdocObject = (content: string) => {
  const ydoc = new Y.Doc()
  const update = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
  Y.applyUpdate(ydoc, update)
  const prosemirrorJson = ProsemirrorTransformer.fromYdoc(ydoc)
  return prosemirrorJson.default
}

/**
 * Format relative time (e.g., "2 min ago", "1 hour ago", "Yesterday")
 */
export const formatRelativeTime = (date: Date | string): string => {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return then.toLocaleDateString(navigator.language, {
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format time for display (e.g., "9:28 PM")
 */
export const formatTime = (date: Date | string): string => {
  return new Date(date).toLocaleTimeString(navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format date header (e.g., "Today", "Yesterday", "Mon, Jan 5")
 */
export const formatDateHeader = (date: Date | string): string => {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (dateOnly.getTime() === today.getTime()) return 'Today'
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday'

  return d.toLocaleDateString(navigator.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

/**
 * Group versions into sessions (versions saved within 2 min of each other)
 */
export const groupVersionsIntoSessions = (versions: HistoryItem[]): VersionSession[] => {
  if (versions.length === 0) return []

  // Sort by createdAt descending (newest first)
  const sorted = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const sessions: VersionSession[] = []
  let currentSession: HistoryItem[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = new Date(sorted[i].createdAt).getTime()
    const prev = new Date(sorted[i - 1].createdAt).getTime()

    // If gap is less than SESSION_GAP_MS, add to current session
    if (prev - current <= SESSION_GAP_MS) {
      currentSession.push(sorted[i])
    } else {
      // Start new session
      sessions.push(createSession(currentSession, sessions.length === 0))
      currentSession = [sorted[i]]
    }
  }

  // Don't forget the last session
  if (currentSession.length > 0) {
    sessions.push(createSession(currentSession, sessions.length === 0))
  }

  return sessions
}

const createSession = (versions: HistoryItem[], isLatest: boolean): VersionSession => {
  const times = versions.map((v) => new Date(v.createdAt).getTime())
  return {
    id: `session-${versions[0].version}`,
    versions,
    startTime: new Date(Math.min(...times)),
    endTime: new Date(Math.max(...times)),
    isLatest
  }
}

/**
 * Group sessions by day
 */
export const groupSessionsByDay = (history: HistoryItem[]): GroupedByDay => {
  const sessions = groupVersionsIntoSessions(history)

  return sessions.reduce((groups, session) => {
    const dayKey = formatDateHeader(session.endTime)

    if (!groups[dayKey]) {
      groups[dayKey] = []
    }
    groups[dayKey].push(session)
    return groups
  }, {} as GroupedByDay)
}

/**
 * Check if a day contains the active version
 */
export const dayContainsVersion = (sessions: VersionSession[], version: number): boolean => {
  return sessions.some((session) => session.versions.some((v) => v.version === version))
}

/**
 * Check if a session contains the active version
 */
export const sessionContainsVersion = (session: VersionSession, version: number): boolean => {
  return session.versions.some((v) => v.version === version)
}

// Legacy exports for backwards compatibility
export const groupContainsCurrentVersion = (items: HistoryItem[], currentVersion: number) => {
  return items.some((item) => item.version === currentVersion)
}

export const dayContainsCurrentVersion = (
  hourGroups: { [hour: string]: HistoryItem[] },
  currentVersion: number
) => {
  return Object.values(hourGroups).some((items) =>
    groupContainsCurrentVersion(items, currentVersion)
  )
}

export const groupHistoryByDay = (history: HistoryItem[]) => {
  return history.reduce(
    (groups, item) => {
      const date = new Date(item.createdAt)
      const dayKey = date.toLocaleDateString(navigator.language, {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const hourKey = date.toLocaleTimeString(navigator.language, {
        hour: 'numeric',
        hour12: true
      })

      if (!groups[dayKey]) {
        groups[dayKey] = {}
      }
      if (!groups[dayKey][hourKey]) {
        groups[dayKey][hourKey] = []
      }
      groups[dayKey][hourKey].push(item)
      return groups
    },
    {} as { [date: string]: { [hour: string]: HistoryItem[] } }
  )
}

export const formatVersionDate = (date: Date | string) => {
  const dateObj = new Date(date)
  return {
    date: dateObj.toLocaleDateString(navigator.language, {
      month: 'long',
      day: 'numeric'
    }),
    time: dateObj.toLocaleTimeString(navigator.language, {
      hour: 'numeric',
      minute: '2-digit'
    })
  }
}
