import { useStore } from '@stores'
import { useCallback } from 'react'

export const useVersionRestore = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const { setLoadingHistory, activeHistory } = useStore((state) => state)

  const handleRestore = useCallback(() => {
    if (!activeHistory?.version) return

    if (window.confirm(`Are you sure you want to revert to version ${activeHistory.version}?`)) {
      setLoadingHistory(true)
      const {
        editor: { instance }
      } = useStore.getState().settings

      if (instance) {
        const meta = hocuspocusProvider.configuration.document.getMap('metadata')
        meta.set('commitMessage', `Reverted to version ${activeHistory.version}`)
        instance.commands.setContent(activeHistory.data)
        window.location.hash = ''
      }
    }
  }, [hocuspocusProvider])

  return { handleRestore }
}
