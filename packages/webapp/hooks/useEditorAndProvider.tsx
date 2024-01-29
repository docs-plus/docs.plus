import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import randomColor from 'randomcolor'
import { toast } from 'react-hot-toast'
import useApplyFilters from '@hooks/useApplyFilters'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'
import { useStore, useAuthStore } from '@stores'

const getCursorUser = (user: any, displayName: string | null | undefined) => {
  const lastUpdate = Date.now().toString()
  let bucketAddress = user?.user_metadata?.avatar_url || '/assets/avatar.svg'
  if (user?.avatar_url) {
    bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png?${lastUpdate}`
  }

  return {
    name: displayName,
    username: user?.username || displayName,
    avatar: bucketAddress,
    id: user.id,
    color: randomColor()
  }
}

const useEditorAndProvider = () => {
  const user = useAuthStore((state) => state.profile)
  const displayName = useAuthStore((state) => state.displayName)
  const docMetadata = useDocumentMetadataContext() as any
  const { editor: editorSetting } = useStore((state) => state.settings)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  // TODO: this cuase rerending 3 times
  const { provider, ydoc } = useYdocAndProvider(docMetadata?.documentId)

  useEffect(() => {
    if (!provider) return
    if (user && !editorSetting?.loading) {
      provider.setAwarenessField('user', getCursorUser(user, displayName))
    }
  }, [provider, user, displayName, editorSetting?.loading])

  const editor = useEditor(editorConfig({ provider, ydoc }), [
    editorSetting?.loading,
    editorSetting?.applyingFilters,
    provider
  ])

  useEffect(() => {
    if (!editor) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
  }, [editor])

  // update user awareness
  useEffect(() => {
    if (editorSetting?.loading) return
    if (editor?.commands?.updateUser && user) {
      editor.commands.updateUser(getCursorUser(user, displayName))
    }
    if (editor) {
      if (docMetadata?.ownerId === user?.id) {
        return editor.setEditable(true)
      }
      editor.setEditable(!docMetadata?.readOnly)
    }
  }, [editor, editorSetting?.loading, user, displayName, docMetadata])

  // readOnly handler
  useEffect(() => {
    if (!provider) return

    const statelessHandler = ({ payload }: any) => {
      const payloadData = JSON.parse(payload)

      if (payloadData.type === 'readOnly') {
        if (!editor) return

        if (docMetadata.ownerId === user?.id) return editor.setEditable(true)

        editor.setEditable(!payloadData.state)

        if (payloadData.state) return toast.error('Document is now read only')
        toast.success('Document is now editable')
      }
    }

    provider.on('stateless', statelessHandler)

    return () => {
      if (provider) {
        provider.off('stateless', statelessHandler)
      }
    }
  }, [provider, editor, user, docMetadata, editorSetting?.loading])

  useApplyFilters(editor)

  useEffect(() => {
    if (editorSetting?.loading && editorSetting?.applyingFilters) return
    setWorkspaceEditorSetting('rendering', false)
  }, [editorSetting?.loading, editorSetting?.applyingFilters])

  useEffect(() => {
    if (!provider) return
    const awarenessUpdateHandler = ({ states }: any) => {
      if (states.length === 0) return
      if (!user) return setWorkspaceEditorSetting('presentUsers', states)
      // if user is present, remove it from the list
      setWorkspaceEditorSetting(
        'presentUsers',
        editorSetting.presentUsers.filter((x: { user: { id: string } }) => x.user?.id !== user.id)
      )
    }

    provider.on('awarenessUpdate', awarenessUpdateHandler)

    return () => {
      if (provider) {
        provider.off('awarenessUpdate', awarenessUpdateHandler)
      }
    }
  }, [provider, user])

  // FIXME: this cuase rerending other components that depend on useEditorStateContext! "Drill props down instead"
  // // The selection has changed.
  // useEffect(() => {
  //   if (!editor || editorSetting?.loading) return

  //   editor.on('selectionUpdate', ({ editor }) => {
  //     setSelectionPos(editor.state.selection?.$anchor?.pos)
  //   })

  //   return () => {
  //     editor.off('selectionUpdate')
  //   }
  // }, [editor, editorSetting?.loading])

  return { editor, provider }
}

export default useEditorAndProvider
