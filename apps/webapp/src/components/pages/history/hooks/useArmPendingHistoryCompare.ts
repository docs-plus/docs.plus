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
  const historyAnchor = useStore((state) => state.historyAnchor)
  const activeHistory = useStore((state) => state.activeHistory)
  const loadingHistory = useStore((state) => state.loadingHistory)
  const pendingWatchVersion = useStore((state) => state.pendingWatchVersion)
  const pendingCompareVersion = useStore((state) => state.pendingCompareVersion)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const historyHasMore = useStore((state) => state.historyHasMore)
  const silentListRefresh = useStore((state) => state.silentListRefresh)
  const setSilentListRefresh = useStore((state) => state.setSilentListRefresh)
  const sinceSendsRef = useRef<{ since: string; sends: number } | null>(null)
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

    // Last left can sit below the loaded pages. Ask once with `since` after the list gap,
    // and retry a refusal once. Arm from an echoed Anchor; never fall back to the oldest
    // loaded row while older pages exist. Count a send only when it leaves: a re-render
    // cancels the timer.
    const anchor = historyAnchor?.since === pendingCompareSince ? historyAnchor.item : null
    const sinceAt = Date.parse(pendingCompareSince)
    if (
      !anchor &&
      historyHasMore &&
      !historyList.some((item) => Date.parse(item.createdAt) <= sinceAt)
    ) {
      const since = pendingCompareSince
      const sent = sinceSendsRef.current
      const sends = sent?.since === since ? sent.sends : 0
      if (sends >= 2) {
        setPendingCompareSince(null)
        return
      }
      const timer = setTimeout(() => {
        sinceSendsRef.current = { since, sends: sends + 1 }
        setSilentListRefresh(true)
        sendHistoryListRequest(hocuspocusProvider, documentId, { since })
      }, HISTORY_LIST_GAP_MS)
      return () => clearTimeout(timer)
    }

    const picked = pickCompareBaseSince(
      anchor ? [...historyList, anchor] : historyList,
      pendingCompareSince
    )
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
    historyAnchor,
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
