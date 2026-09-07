import * as toast from '@components/toast'
import { useStore } from '@stores'
import { useEffect } from 'react'

import { pickCompareBaseSince } from '../pickCompareBaseSince'
import { useHistoryCompare } from './useHistoryCompare'
import { useVersionContent } from './useVersionContent'

/** Consumes `pendingCompareSince` once B (latest) is loaded, then paints compare. */
export function useArmPendingHistoryCompare(): void {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const pendingCompareSince = useStore((state) => state.pendingCompareSince)
  const setPendingCompareSince = useStore((state) => state.setPendingCompareSince)
  const historyList = useStore((state) => state.historyList)
  const activeHistory = useStore((state) => state.activeHistory)
  const loadingHistory = useStore((state) => state.loadingHistory)
  const pendingWatchVersion = useStore((state) => state.pendingWatchVersion)
  const pendingCompareVersion = useStore((state) => state.pendingCompareVersion)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const { enterCompare, exitCompare } = useHistoryCompare()
  const { watchVersionContent } = useVersionContent()

  useEffect(() => {
    if (!pendingCompareSince) return
    if (!hocuspocusProvider) return
    if (loadingHistory || pendingWatchVersion != null || pendingCompareVersion != null) return
    if (!activeHistory || historyList.length === 0) return

    const head = historyList[0]
    if (!head) return

    const base = pickCompareBaseSince(historyList, pendingCompareSince)
    if (!base) {
      setPendingCompareSince(null)
      toast.Info('No earlier version to compare against.')
      return
    }

    if (activeHistory.version !== head.version) {
      watchVersionContent(head.version, { updateUrl: false })
      return
    }

    if (compareMode && compareBaseItem?.version === base.version) {
      setPendingCompareSince(null)
      return
    }

    setPendingCompareSince(null)
    exitCompare()
    if (!enterCompare(base.version)) {
      toast.Info('No earlier version to compare against.')
    }
  }, [
    pendingCompareSince,
    hocuspocusProvider,
    loadingHistory,
    pendingWatchVersion,
    pendingCompareVersion,
    activeHistory,
    historyList,
    compareMode,
    compareBaseItem,
    setPendingCompareSince,
    watchVersionContent,
    enterCompare,
    exitCompare
  ])
}
