import * as toast from '@components/toast'
import { useAuthStore, useStore } from '@stores'
import { useCallback, useState } from 'react'

import { tryGetProsemirrorFromHistoryYdoc } from '../helpers'

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

  const cancelRestore = useCallback(() => setRestoreOpen(false), [])

  const confirmRestore = useCallback(() => {
    if (!activeHistory?.version) return
    if (!hocuspocusProvider) {
      toast.Error('Connection unavailable. Try again when the document is connected.')
      return
    }

    const content = tryGetProsemirrorFromHistoryYdoc(activeHistory.data)
    if (content == null) {
      toast.Error('Could not read this version. Try another version or reload.')
      return
    }

    setLoadingHistory(true)
    const {
      editor: { instance: editor }
    } = useStore.getState().settings

    if (editor) {
      try {
        const meta = hocuspocusProvider.configuration.document.getMap('metadata')
        meta.set('commitMessage', `Reverted to version ${activeHistory.version}`)
        editor.commands.setContent(content)
        window.location.hash = ''
      } catch (e) {
        console.error(e)
        toast.Error('Could not apply this version.')
      } finally {
        setLoadingHistory(false)
      }
    } else {
      setLoadingHistory(false)
      toast.Error('Editor is not ready.')
    }
  }, [activeHistory, hocuspocusProvider, setLoadingHistory])

  return { restoreOpen, setRestoreOpen, requestRestore, cancelRestore, confirmRestore }
}
