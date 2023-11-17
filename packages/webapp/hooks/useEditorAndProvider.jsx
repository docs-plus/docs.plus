import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import randomColor from 'randomcolor'
import { toast } from 'react-hot-toast'
import useApplyFilters from '@hooks/useApplyFilters'
import { useEditorStateContext } from '@context/EditorContext'
import useProfileData from '@hooks/useProfileData'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { useAuthStore } from '@utils/supabase'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'

const getCursorUser = (user, profileData) => {
  const lastUpdate = Date.now().toString()
  let bucketAddress = user?.user_metadata?.avatar_url || '/assets/avatar.svg'
  if (profileData?.avatar_url) {
    bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png?${lastUpdate}`
  }

  return {
    name: profileData?.full_name || user.user_metadata.full_name,
    username: profileData?.username || user.user_metadata.user_name,
    avatar: bucketAddress,
    id: user.id,
    color: randomColor()
  }
}

const useEditorAndProvider = () => {
  const user = useAuthStore.use.user()
  const docMetadata = useDocumentMetadataContext()

  const {
    setRendering,
    setPresentUsers,
    loading,
    applyingFilters,
    setApplyingFilters,
    setLoading
  } = useEditorStateContext()

  const { profileData } = useProfileData()

  // TODO: this cuase rerending 3 times
  const { provider } = useYdocAndProvider(docMetadata.documentId, setLoading)

  useEffect(() => {
    if (!provider) return
    if (profileData && !loading) {
      provider.setAwarenessField('user', getCursorUser(user, profileData))
    }
  }, [provider, user, profileData, loading])

  const editor = useEditor(editorConfig({ provider, applyingFilters }), [loading, applyingFilters])

  // update user awareness
  useEffect(() => {
    if (loading) return
    if (editor?.commands?.updateUser && user) {
      editor.commands.updateUser(getCursorUser(user, profileData))
    }
    if (editor) {
      if (docMetadata.ownerId === user?.id) {
        return editor.setEditable(true)
      }
      editor.setEditable(!docMetadata.readOnly)
    }
  }, [editor, loading, user, profileData, docMetadata])

  // readOnly handler
  useEffect(() => {
    if (!provider) return

    const statelessHandler = ({ payload }) => {
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
  }, [provider, editor, user, docMetadata, loading])

  useApplyFilters(editor)

  useEffect(() => {
    if (loading && setApplyingFilters) return
    setRendering(false)
  }, [loading, setRendering, setApplyingFilters])

  useEffect(() => {
    if (!provider) return
    const awarenessUpdateHandler = ({ states }) => {
      if (states.length === 0) return
      if (!user) return setPresentUsers(states)
      // if user is present, remove it from the list
      setPresentUsers(() => {
        return states.filter((x) => x.user?.id !== user.id)
      })
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
  //   if (!editor || loading) return

  //   editor.on('selectionUpdate', ({ editor }) => {
  //     setSelectionPos(editor.state.selection?.$anchor?.pos)
  //   })

  //   return () => {
  //     editor.off('selectionUpdate')
  //   }
  // }, [editor, loading])

  return { editor, provider }
}

export default useEditorAndProvider
