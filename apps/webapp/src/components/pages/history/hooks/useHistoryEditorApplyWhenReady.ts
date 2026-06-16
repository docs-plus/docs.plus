import { useStore } from '@stores'
import { useEffect } from 'react'

import { applyHistoryItemToEditor, resolveHistoryApplyResult } from '../applyHistoryToEditor'

/**
 * Server data can beat `history` store `editor`; keep loading until apply succeeds.
 * Skip while `pendingWatchVersion` is set — `activeHistory` is still the prior row.
 */
export function useHistoryEditorApplyWhenReady() {
  const editor = useStore((s) => s.editor)
  const activeHistory = useStore((s) => s.activeHistory)
  const loadingHistory = useStore((s) => s.loadingHistory)
  const pendingWatchVersion = useStore((s) => s.pendingWatchVersion)
  const setLoadingHistory = useStore((s) => s.setLoadingHistory)

  useEffect(() => {
    if (!loadingHistory) return
    if (pendingWatchVersion != null) return
    if (!activeHistory?.data) return

    resolveHistoryApplyResult(applyHistoryItemToEditor(editor, activeHistory), {
      logMessage: 'History: decode_failed when applying activeHistory (editor became ready)',
      setLoadingHistory
    })
  }, [editor, activeHistory, loadingHistory, pendingWatchVersion, setLoadingHistory])
}
