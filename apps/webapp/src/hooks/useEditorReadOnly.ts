import { useStore } from '@stores'
import { useEffect } from 'react'

const useEditorReadOnly = () => {
  const provider = useStore((state) => state.settings.hocuspocusProvider)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!provider || !editor) return

    const statelessHandler = ({ payload: _payload }: { payload: string }) => {
      // TODO: Re-enable read-only handling when backend implementation is ready
    }

    provider.on('stateless', statelessHandler)

    return () => {
      provider.off('stateless', statelessHandler)
    }
  }, [provider, editor])
}

export default useEditorReadOnly
