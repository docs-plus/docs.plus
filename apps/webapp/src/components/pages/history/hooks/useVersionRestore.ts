import { clearHistoryHash } from '@components/pages/history/historyShareUrl'
import * as toast from '@components/toast'
import { useAuthStore, useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import { logger } from '@utils/logger'
import { useCallback, useState } from 'react'

import { getCachedProsemirrorFromHistoryYdoc } from '../historyDecodeCache'

const PAD_EDITOR_WAIT_MS = 15_000

function waitForPadEditor(timeoutMs = PAD_EDITOR_WAIT_MS): Promise<Editor> {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const tick = () => {
      const editor = useStore.getState().settings.editor.instance
      if (editor && !editor.isDestroyed) {
        resolve(editor)
        return
      }
      if (performance.now() - started > timeoutMs) {
        reject(new Error('pad editor timeout'))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

export const useVersionRestore = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const activeHistory = useStore((state) => state.activeHistory)
  const user = useAuthStore((state) => state.profile)

  const [restoreOpen, setRestoreOpen] = useState(false)

  const requestRestore = useCallback(() => {
    if (!activeHistory?.version) return
    if (!user) {
      toast.Error('Please login to restore this version')
      return
    }
    setRestoreOpen(true)
  }, [activeHistory?.version, user])

  const confirmRestore = useCallback(async () => {
    if (!activeHistory?.version) return
    if (!hocuspocusProvider) {
      toast.Error('Connection unavailable. Try again when the document is connected.')
      return
    }

    const content = getCachedProsemirrorFromHistoryYdoc(activeHistory.version, activeHistory.data)
    if (content == null) {
      toast.Error('Could not read this version. Try another version or reload.')
      return
    }

    setLoadingHistory(true)
    clearHistoryHash()

    try {
      const editor = await waitForPadEditor()
      const meta = hocuspocusProvider.configuration.document.getMap('metadata')
      meta.set('commitMessage', `Reverted to version ${activeHistory.version}`)
      editor.commands.setContent(content)
    } catch (e) {
      if (e instanceof Error && e.message === 'pad editor timeout') {
        toast.Error('Editor is not ready.')
      } else {
        logger.error('History restore: setContent failed', e)
        toast.Error('Could not apply this version.')
      }
    } finally {
      setLoadingHistory(false)
    }
  }, [activeHistory, hocuspocusProvider, setLoadingHistory])

  return { restoreOpen, setRestoreOpen, requestRestore, confirmRestore }
}
