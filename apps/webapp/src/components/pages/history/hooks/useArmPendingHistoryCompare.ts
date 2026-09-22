import * as toast from '@components/toast'
import { useStore } from '@stores'
import { useEffect, useRef } from 'react'

import { HISTORY_LIST_GAP_MS, sendHistoryListRequest } from '../historyStatelessWire'
import { compareBaseSinceMessage, pickCompareBaseSince } from '../pickCompareBaseSince'
import { useHistoryCompare } from './useHistoryCompare'
import { useVersionContent } from './useVersionContent'

/** Consumes `pendingCompareSince` once B (latest) is loaded, then paints compare. */
export function useArmPendingHistoryCompare(): void {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const pendingCompareSince = useStore((state) => state.pendingCompareSince)
  const setPendingCompareSince = useStore((state) => state.setPendingCompareSince)
  const historyList = useStore((state) => state.historyList)
  const activeHistory = useStore((state) => state.activeHistory)
  const loadingHistory = useStore((state) => state.loadingHistory)
  const pendingWatchVersion = useStore((state) => state.pendingWatchVersion)
  const pendingCompareVersion = useStore((state) => state.pendingCompareVersion)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const historyHasMore = useStore((state) => state.historyHasMore)
  const silentListRefresh = useStore((state) => state.silentListRefresh)
  const setSilentListRefresh = useStore((state) => state.setSilentListRefresh)
  const requestedSinceRef = useRef<string | null>(null)
  const { enterCompare, exitCompare } = useHistoryCompare()
  const { watchVersionContent } = useVersionContent()

  useEffect(() => {
    if (!pendingCompareSince) return
    if (!hocuspocusProvider) return
    // One silent flag covers one list at a time, so wait for any silent list to land.
    if (loadingHistory || silentListRefresh) return
    if (pendingWatchVersion != null || pendingCompareVersion != null) return
    if (!activeHistory || historyList.length === 0) return

    const head = historyList[0]
    if (!head) return

    // Last left arrived after the list, so no loaded row sits at or before it.
    // Re-list once with `since`; the first-page merge keeps older pages and adds the anchor.
    // Wait out the list cooldown. Mark the request only when it leaves: any re-render
    // cancels the timer, and a mark set earlier would skip the send and pick the wrong base.
    const sinceAt = Date.parse(pendingCompareSince)
    if (
      historyHasMore &&
      !historyList.some((item) => Date.parse(item.createdAt) <= sinceAt) &&
      requestedSinceRef.current !== pendingCompareSince
    ) {
      const since = pendingCompareSince
      const timer = setTimeout(() => {
        requestedSinceRef.current = since
        setSilentListRefresh(true)
        sendHistoryListRequest(hocuspocusProvider, documentId, { since })
      }, HISTORY_LIST_GAP_MS)
      return () => clearTimeout(timer)
    }

    const picked = pickCompareBaseSince(historyList, pendingCompareSince)
    if (picked.kind !== 'base') {
      setPendingCompareSince(null)
      const message = compareBaseSinceMessage(picked)
      if (message) toast.Info(message)
      return
    }
    const base = picked.item

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
    // A refusal here means the provider went away, not that the document stood
    // still, and neither frozen message states that. Say nothing.
    enterCompare(base.version)
  }, [
    pendingCompareSince,
    hocuspocusProvider,
    documentId,
    loadingHistory,
    pendingWatchVersion,
    pendingCompareVersion,
    activeHistory,
    historyList,
    compareMode,
    compareBaseItem,
    historyHasMore,
    silentListRefresh,
    setSilentListRefresh,
    setPendingCompareSince,
    watchVersionContent,
    enterCompare,
    exitCompare
  ])
}
