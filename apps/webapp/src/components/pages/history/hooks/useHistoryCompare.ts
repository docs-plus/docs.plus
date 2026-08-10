import { sendHistoryWatchRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback } from 'react'

/**
 * Compare picks a second version (A) to diff the viewed one (B) against. A rides its own
 * watch slot, so the viewer's version is never replaced. B never re-watches while compare
 * is on, and that is what makes an un-echoed failure attributable.
 */
export const useHistoryCompare = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const pendingWatchVersion = useStore((state) => state.pendingWatchVersion)
  const setCompareMode = useStore((state) => state.setCompareMode)
  const setCompareBaseItem = useStore((state) => state.setCompareBaseItem)
  const setPendingCompareVersion = useStore((state) => state.setPendingCompareVersion)

  const activeIndex = activeHistory
    ? historyList.findIndex((item) => item.version === activeHistory.version)
    : -1
  const previousEntry = activeIndex >= 0 ? historyList[activeIndex + 1] : undefined
  const canCompare = pendingWatchVersion == null && Boolean(previousEntry)

  const selectCompareBase = useCallback(
    (version: number) => {
      if (!hocuspocusProvider) return
      if (activeHistory?.version === version) return
      setPendingCompareVersion(version)
      sendHistoryWatchRequest(hocuspocusProvider, version, documentId)
    },
    [activeHistory?.version, documentId, hocuspocusProvider, setPendingCompareVersion]
  )

  const exitCompare = useCallback(() => {
    setCompareMode(false)
    setCompareBaseItem(null)
    setPendingCompareVersion(null)
  }, [setCompareBaseItem, setCompareMode, setPendingCompareVersion])

  const toggleCompare = useCallback(() => {
    if (compareMode) {
      exitCompare()
      return
    }
    if (!previousEntry) return
    setCompareMode(true)
    selectCompareBase(previousEntry.version)
  }, [compareMode, exitCompare, previousEntry, selectCompareBase, setCompareMode])

  return {
    compareMode,
    compareBaseItem,
    canCompare,
    toggleCompare,
    selectCompareBase,
    exitCompare
  }
}
