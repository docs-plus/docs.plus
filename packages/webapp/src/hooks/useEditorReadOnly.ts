import { useStore } from '@stores'
import { useEffect } from 'react'

const useEditorReadOnly = () => {
  const {
    hocuspocusProvider: provider,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // This runs when stateless event is fired
  useEffect(() => {
    if (!provider || !editor) return

    const statelessHandler = ({ payload: _payload }: { payload: string }) => {
      // TODO: Re-enable read-only handling when backend implementation is ready
      // Currently disabled as the feature is not yet complete
    }

    provider.on('stateless', statelessHandler)

    return () => {
      provider?.off('stateless', statelessHandler)
    }
  }, [provider, editor])
}

export default useEditorReadOnly
