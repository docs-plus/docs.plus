import { useAuthStore, useStore } from '@stores'
import { useCallback } from 'react'
import { getContentFromYdocObject } from '../helpers'
import * as toast from '@components/toast'

export const useVersionRestore = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const { setLoadingHistory, activeHistory } = useStore((state) => state)
  const user = useAuthStore((state) => state.profile)

  const handleRestore = useCallback(() => {
    if (!activeHistory?.version) return
    if (!user) {
      toast.Error('Please login to restore this version')
      return
    }

    if (window.confirm(`Are you sure you want to revert to version ${activeHistory.version}?`)) {
      setLoadingHistory(true)
      const {
        editor: { instance: editor }
      } = useStore.getState().settings

      if (editor) {
        const meta = hocuspocusProvider.configuration.document.getMap('metadata')
        meta.set('commitMessage', `Reverted to version ${activeHistory.version}`)

        const content = getContentFromYdocObject(activeHistory.data)

        editor.commands.setContent(content)
        window.location.hash = ''
      }
    }
  }, [hocuspocusProvider, activeHistory])

  return { handleRestore }
}
