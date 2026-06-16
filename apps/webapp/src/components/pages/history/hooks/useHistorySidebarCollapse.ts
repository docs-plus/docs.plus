import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react'

import { dayContainsVersion, sessionContainsVersion } from '../helpers'
import type { GroupedByDay } from '../types'

function toggleSetKey(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
  setter((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
}

export function useHistorySidebarCollapse(groupedByDay: GroupedByDay, activeVersion: number) {
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set())
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!activeVersion) return

    const daysToOpen = new Set<string>()
    const sessionsToExpand = new Set<string>()

    for (const [dayLabel, sessions] of Object.entries(groupedByDay)) {
      if (dayContainsVersion(sessions, activeVersion)) {
        daysToOpen.add(dayLabel)
      }
      for (const session of sessions) {
        if (session.versions.length > 1 && sessionContainsVersion(session, activeVersion)) {
          sessionsToExpand.add(session.id)
        }
      }
    }

    setOpenDays((prev) => new Set([...prev, ...daysToOpen]))
    setExpandedSessions((prev) => new Set([...prev, ...sessionsToExpand]))
  }, [activeVersion, groupedByDay])

  const toggleDay = useCallback((dayKey: string) => toggleSetKey(setOpenDays, dayKey), [])
  const toggleSession = useCallback(
    (sessionId: string) => toggleSetKey(setExpandedSessions, sessionId),
    []
  )

  return { openDays, expandedSessions, toggleDay, toggleSession }
}
