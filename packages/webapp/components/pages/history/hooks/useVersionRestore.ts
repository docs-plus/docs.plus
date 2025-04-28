import { useStore } from '@stores'
import { useCallback } from 'react'
import { getContentFromYdocObject } from '../helpers'

export const useVersionRestore = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const { setLoadingHistory, activeHistory } = useStore((state) => state)

  const handleRestore = useCallback(() => {
    if (!activeHistory?.version) return

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
