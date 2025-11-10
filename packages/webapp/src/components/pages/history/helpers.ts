import * as Y from 'yjs'
import { ProsemirrorTransformer } from '@hocuspocus/transformer'
import { HistoryItem } from '@types'

interface GroupedHistory {
  [date: string]: {
    [hour: string]: HistoryItem[]
  }
}

const DATE_FORMAT_OPTIONS = {
  date: {
    month: 'long',
    day: 'numeric'
  } as const,
  time: {
    hour: 'numeric',
    minute: '2-digit'
  } as const
}

export const getContentFromYdocObject = (content: string) => {
  const ydoc = new Y.Doc()
  const update = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
  Y.applyUpdate(ydoc, update)
  const prosemirrorJson = ProsemirrorTransformer.fromYdoc(ydoc)
  return prosemirrorJson.default
}

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

export const groupHistoryByDay = (history: HistoryItem[]): GroupedHistory => {
  return history.reduce((groups, item) => {
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
  }, {} as GroupedHistory)
}

export const formatVersionDate = (date: Date | string) => {
  const dateObj = new Date(date)
  return {
    date: dateObj.toLocaleDateString(navigator.language, DATE_FORMAT_OPTIONS.date),
    time: dateObj.toLocaleTimeString(navigator.language, DATE_FORMAT_OPTIONS.time)
  }
}
