import { useStore } from '@stores'
import type { HistoryItem } from '@types'
import { useMemo } from 'react'

export type HistoryToolbarVersion = HistoryItem & { isLatestVersion: boolean }

/** Enriched row for the active version (toolbar, restore affordance). */
export const useGetVersionInfo = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)

  return useMemo(() => {
    if (!activeHistory || !historyList.length) return null
    const versionInfo = historyList.find((item) => item.version === activeHistory.version)
    if (!versionInfo) return null

    return {
      ...versionInfo,
      isLatestVersion: historyList[0]?.version === activeHistory.version
    } satisfies HistoryToolbarVersion
  }, [activeHistory, historyList])
}
