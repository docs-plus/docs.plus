import { useStore } from '@stores'
import { useMemo } from 'react'

import { groupSessionsByDay } from '../helpers'
import { buildHistorySidebarRows } from '../utils/sidebarRows'
import { useHistorySidebarCollapse } from './useHistorySidebarCollapse'

export function useHistorySidebarRows() {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const activeVersion = (activeHistory ?? historyList[0])?.version ?? 0

  const groupedByDay = useMemo(
    () => (historyList.length > 0 ? groupSessionsByDay(historyList) : {}),
    [historyList]
  )
  const { openDays, expandedSessions, toggleDay, toggleSession } = useHistorySidebarCollapse(
    groupedByDay,
    activeVersion
  )
  const rows = useMemo(
    () => buildHistorySidebarRows(groupedByDay, openDays, expandedSessions),
    [groupedByDay, openDays, expandedSessions]
  )

  return { historyList, activeVersion, rows, openDays, toggleDay, toggleSession }
}
