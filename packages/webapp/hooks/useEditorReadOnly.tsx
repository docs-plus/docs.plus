import { useEffect } from 'react'
import { useAuthStore, useStore } from '@stores'
import { toast } from 'react-hot-toast'

const useEditorReadOnly = () => {
  const user = useAuthStore((state) => state.profile)
  const {
    metadata,
    hocuspocusProvider: provider,
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  // readOnly handler

  // this runs when statless event is fired
  useEffect(() => {
    if (!provider || !editor) return

    const statelessHandler = ({ payload }: any) => {
      const payloadData = JSON.parse(payload)

      if (payloadData.type === 'readOnly') {
        if (!editor) return

        if (metadata.ownerId === user?.id) return editor.setEditable(true)

        editor.setEditable(!payloadData.state)

        if (payloadData.state) return toast.error('Document is now read only')
        toast.success('Document is now editable')
      }
    }

    provider.on('stateless', statelessHandler)

    return () => {
      provider?.off('stateless', statelessHandler)
    }
  }, [provider, editor, user, metadata])
}

export default useEditorReadOnly
