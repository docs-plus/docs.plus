import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import randomColor from 'randomcolor'
import { toast } from 'react-hot-toast'
import { useUser } from '@supabase/auth-helpers-react'
import useApplyFilters from '@hooks/useApplyFilters'
import { useRouter } from 'next/router'
import { useEditorStateContext } from '@context/EditorContext'
import useProfileData from '@hooks/useProfileData'
import useYdocAndProvider from '@hooks/useYdocAndProvider'

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

const useEditorAndProvider = ({ docMetadata }) => {
  const user = useUser()
  const router = useRouter()
  const { slugs } = router.query
  const { rendering, setRendering, loading, applyingFilters, setApplyingFilters, setLoading } = useEditorStateContext()
  const { profileData } = useProfileData()

  // TODO: this cuase rerending 3 times
  const { provider } = useYdocAndProvider(docMetadata.documentId, setLoading)

  useEffect(() => {
    if (provider) {
      provider.on('awarenessUpdate', ({ states }) => {
        // console.log(states, '====>>>>awarenessUpdateHandler')
      })

      if (profileData && !loading) {
        provider.setAwarenessField('user', getCursorUser(user, profileData))
      }
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
  }, [provider, editor, user, docMetadata])

  useApplyFilters(editor, slugs, applyingFilters, setApplyingFilters, router, rendering)

  useEffect(() => {
    if (loading && setApplyingFilters) return
    setRendering(false)
  }, [loading, setRendering, setApplyingFilters])

  return { editor, provider }
}

export default useEditorAndProvider
