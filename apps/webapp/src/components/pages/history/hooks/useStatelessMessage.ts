import type { HistoryStatelessPayload } from '@components/pages/history/historyStatelessWire'
import { handleHistoryStatelessPayload } from '@components/pages/history/statelessMessageHandlers'
import { useStore } from '@stores'
import { useCallback } from 'react'

import { useVersionContent } from './useVersionContent'

export const useStatelessMessage = () => {
  const setHistoryList = useStore((state) => state.setHistoryList)
  const setActiveHistory = useStore((state) => state.setActiveHistory)
  const setLatestSnapshot = useStore((state) => state.setLatestSnapshot)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setPendingWatchVersion = useStore((state) => state.setPendingWatchVersion)
  const { watchVersionContent } = useVersionContent()

  const handleStatelessMessage = useCallback(
    (event: { payload: string }) => {
      let payloadData: HistoryStatelessPayload
      try {
        payloadData = JSON.parse(event.payload) as HistoryStatelessPayload
      } catch {
        return
      }

      handleHistoryStatelessPayload(payloadData, {
        setHistoryList,
        setActiveHistory,
        setLatestSnapshot,
        setLoadingHistory,
        setPendingWatchVersion,
        getEditor: () => useStore.getState().editor,
        getHistoryList: () => useStore.getState().historyList,
        getLatestSnapshot: () => useStore.getState().latestSnapshot,
        getPendingWatchVersion: () => useStore.getState().pendingWatchVersion,
        watchVersionContent
      })
    },
    [
      setActiveHistory,
      setHistoryList,
      setLatestSnapshot,
      setLoadingHistory,
      setPendingWatchVersion,
      watchVersionContent
    ]
  )

  return { handleStatelessMessage }
}
