import {
  normalizeToPlainHistoryHash,
  parseHistoryHash,
  replaceHistoryHashVersion,
  resolveHistoryListTargetVersion
} from '@components/pages/history/historyShareUrl'
import * as toast from '@components/toast'
import { useStore } from '@stores'
import type { HistoryItem } from '@types'
import { logger } from '@utils/logger'
import { useCallback } from 'react'

import { applyHistoryItemToEditor, HISTORY_DECODE_FAILED_MESSAGE } from '../applyHistoryToEditor'
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
        const failedType = payloadData.type
        if (failedType === 'history.watch') {
          toast.Error('Could not open this version. Try another or go back to the editor.')
        } else if (failedType === 'history.list') {
          toast.Error('Could not load version history.')
          setHistoryList([])
          setActiveHistory(null)
          normalizeToPlainHistoryHash()
        } else {
          toast.Error('Something went wrong loading history.')
        }
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
          setHistoryList([])
          setActiveHistory(null)
          setLoadingHistory(false)
          toast.Error('Could not load version history.')
          normalizeToPlainHistoryHash()
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
          setHistoryList([])
          setActiveHistory(null)
          setLoadingHistory(false)
          toast.Info('No saved versions for this document yet.')
          normalizeToPlainHistoryHash()
          return
        }

        setHistoryList(list)

        // User already requested a specific version — do not hydrate from a late list or reset watch.
        if (useStore.getState().pendingWatchVersion != null) {
          return
        }

        const resolved = resolveHistoryListTargetVersion(list, window.location.hash)
        if (resolved == null) {
          setPendingWatchVersion(null)
          setLoadingHistory(false)
          return
        }
        const { targetVersion, invalidDeepLink } = resolved
        if (invalidDeepLink) {
          toast.Error("That version isn't available anymore")
          replaceHistoryHashVersion(targetVersion)
        }
        const parsedHash = parseHistoryHash(window.location.hash)
        const syncUrlOnWatch = invalidDeepLink || parsedHash.version != null

        if (latestSnapshot?.data != null && latestSnapshot.version === targetVersion) {
          setActiveHistory(latestSnapshot)
          setPendingWatchVersion(null)
          const result = applyHistoryItemToEditor(useStore.getState().editor, latestSnapshot)
          if (result === 'decode_failed') {
            logger.error('History: could not decode latest snapshot')
            toast.Error(HISTORY_DECODE_FAILED_MESSAGE)
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

        watchVersionContent(targetVersion, { updateUrl: syncUrlOnWatch })
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
          logger.error(`History: could not decode version payload v${response.version}`)
          toast.Error(HISTORY_DECODE_FAILED_MESSAGE)
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
