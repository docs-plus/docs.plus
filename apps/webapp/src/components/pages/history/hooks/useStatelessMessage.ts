import type { HistoryStatelessPayload } from '@components/pages/history/historyStatelessWire'
import { handleHistoryStatelessPayload } from '@components/pages/history/statelessMessageHandlers'
import { useCallback } from 'react'

import { useSilentHistoryRefresh } from './useSilentHistoryRefresh'
import { useVersionContent } from './useVersionContent'

export const useStatelessMessage = () => {
  const { watchVersionContent } = useVersionContent()
  const { requestSilentListRefresh } = useSilentHistoryRefresh()

  const handleStatelessMessage = useCallback(
    (event: { payload: string }) => {
      let payloadData: HistoryStatelessPayload
      try {
        payloadData = JSON.parse(event.payload) as HistoryStatelessPayload
      } catch {
        return
      }

      handleHistoryStatelessPayload(payloadData, {
        requestSilentListRefresh,
        watchVersionContent
      })
    },
    [requestSilentListRefresh, watchVersionContent]
  )

  return { handleStatelessMessage }
}
