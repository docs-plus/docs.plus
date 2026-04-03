import { useStore } from '@stores'
import { useEffect } from 'react'

import { applyHistoryItemToEditor } from '../applyHistoryToEditor'

/**
 * Server data can arrive before `history` store `editor` is set (one frame / slow mount).
 * Keep `loadingHistory` true until we successfully apply `activeHistory` into the TipTap instance.
 *
 * While `pendingWatchVersion` is set (user picked another version / initial watch), `activeHistory`
 * is still the previous row — do not apply it or we would clear loading before the new snapshot arrives.
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

    const result = applyHistoryItemToEditor(editor, activeHistory)
    if (result === 'applied') {
      setLoadingHistory(false)
      return
    }
    if (result === 'decode_failed') {
      setLoadingHistory(false)
    }
  }, [editor, activeHistory, loadingHistory, pendingWatchVersion, setLoadingHistory])
}
