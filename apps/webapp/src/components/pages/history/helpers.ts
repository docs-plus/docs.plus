import { ProsemirrorTransformer } from '@hocuspocus/transformer'
import { HistoryItem } from '@types'
import * as Y from 'yjs'

import type { GroupedByDay, VersionSession } from './types'

const SESSION_GAP_MS = 2 * 60 * 1000

export const getContentFromYdocObject = (content: string) => {
  const ydoc = new Y.Doc()
  const update = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
  Y.applyUpdate(ydoc, update)
  const prosemirrorJson = ProsemirrorTransformer.fromYdoc(ydoc)
  return prosemirrorJson.default
}

/** Safe for network payloads — returns `null` on bad base64 / corrupt Yjs. */
export const tryGetProsemirrorFromHistoryYdoc = (content: string | undefined): unknown | null => {
  if (content == null || content === '') return null
  try {
    return getContentFromYdocObject(content)
  } catch {
    return null
  }
}

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

export const formatTime = (date: Date | string): string => {
  return new Date(date).toLocaleTimeString(navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

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

export const groupVersionsIntoSessions = (versions: HistoryItem[]): VersionSession[] => {
  if (versions.length === 0) return []

  const sorted = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const sessions: VersionSession[] = []
  let currentSession: HistoryItem[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = new Date(sorted[i].createdAt).getTime()
    const prev = new Date(sorted[i - 1].createdAt).getTime()

    if (prev - current <= SESSION_GAP_MS) {
      currentSession.push(sorted[i])
    } else {
      sessions.push(createSession(currentSession, sessions.length === 0))
      currentSession = [sorted[i]]
    }
  }

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

export const dayContainsVersion = (sessions: VersionSession[], version: number): boolean => {
  return sessions.some((session) => session.versions.some((v) => v.version === version))
}

export const sessionContainsVersion = (session: VersionSession, version: number): boolean => {
  return session.versions.some((v) => v.version === version)
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
