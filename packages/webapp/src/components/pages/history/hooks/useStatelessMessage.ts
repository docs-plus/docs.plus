import { useStore } from '@stores'
import type { HistoryItem } from '@types'
import { useCallback } from 'react'

import { applyHistoryItemToEditor } from '../applyHistoryToEditor'
import { useVersionContent } from './useVersionContent'

export const useStatelessMessage = () => {
  const setHistoryList = useStore((state) => state.setHistoryList)
  const setActiveHistory = useStore((state) => state.setActiveHistory)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setPendingWatchVersion = useStore((state) => state.setPendingWatchVersion)
  const { watchVersionContent } = useVersionContent()

  const handleStatelessMessage = useCallback(
    (event: { payload: string }) => {
      let payloadData: { msg?: string; type?: string; response?: unknown; error?: string }
      try {
        payloadData = JSON.parse(event.payload) as typeof payloadData
      } catch {
        return
      }

      if (payloadData.msg !== 'history.response') return

      if (payloadData.error === 'history_failed') {
        setPendingWatchVersion(null)
        setLoadingHistory(false)
        return
      }

      if (payloadData.type === 'history.list') {
        const raw = payloadData.response as
          | HistoryItem[]
          | { versions: HistoryItem[]; latestSnapshot: HistoryItem | null }
          | null
          | undefined

        let list: HistoryItem[]
        let latestSnapshot: HistoryItem | null | undefined

        if (raw == null) {
          setPendingWatchVersion(null)
          setLoadingHistory(false)
          return
        }
        if (Array.isArray(raw)) {
          list = raw
          latestSnapshot = undefined
        } else {
          list = raw.versions ?? []
          latestSnapshot = raw.latestSnapshot ?? null
        }

        const head = list[0]
        if (!list.length || !head) {
          setPendingWatchVersion(null)
          setLoadingHistory(false)
          return
        }

        setHistoryList(list)

        // User already requested a specific version — do not hydrate from a late list or reset watch.
        if (useStore.getState().pendingWatchVersion != null) {
          return
        }

        if (latestSnapshot?.data != null) {
          setActiveHistory(latestSnapshot)
          setPendingWatchVersion(null)
          const result = applyHistoryItemToEditor(useStore.getState().editor, latestSnapshot)
          if (result === 'decode_failed') {
            console.error('History: could not decode latest snapshot')
            setLoadingHistory(false)
            return
          }
          if (result === 'applied') {
            setLoadingHistory(false)
            return
          }
          // no_editor: keep loading; useHistoryEditorApplyWhenReady applies when editor exists
          return
        }

        setActiveHistory(head)
        watchVersionContent(head.version)
      }

      if (payloadData.type === 'history.watch') {
        const response = payloadData.response as HistoryItem | null
        if (response == null) {
          setPendingWatchVersion(null)
          setLoadingHistory(false)
          return
        }
        const pending = useStore.getState().pendingWatchVersion
        if (pending !== response.version) {
          return
        }

        setActiveHistory(response)
        setPendingWatchVersion(null)
        const result = applyHistoryItemToEditor(useStore.getState().editor, response)
        if (result === 'decode_failed') {
          console.error('History: could not decode version payload', response.version)
          setLoadingHistory(false)
          return
        }
        if (result === 'applied') {
          setLoadingHistory(false)
          return
        }
        // no_editor: keep loading until useHistoryEditorApplyWhenReady applies
      }
    },
    [
      setActiveHistory,
      setHistoryList,
      setLoadingHistory,
      setPendingWatchVersion,
      watchVersionContent
    ]
  )

  return { handleStatelessMessage }
}
