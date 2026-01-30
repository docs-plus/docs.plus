import { useAuthStore, useStore } from '@stores'
import randomColor from 'randomcolor'
import { useEffect } from 'react'

// Helper functions
const getCursorUser = (user: any) => {
  let bucketAddress = user?.avatar_url || null //'/assets/avatar.svg'

  if (!user) {
    return {
      name: 'Anonymous',
      displayName: 'Anonymous',
      id: 'anonymous',
      color: randomColor({ luminosity: 'light' }),
      avatarUpdatedAt: null
    }
  }

  return {
    name: user?.display_name,
    displayName: user?.display_name,
    avatarUrl: bucketAddress,
    avatarUpdatedAt: user?.avatar_updated_at,
    id: user?.id,
    color: randomColor({ luminosity: 'light' })
  }
}

const useProviderAwarness = () => {
  const user = useAuthStore((state) => state.profile)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const {
    hocuspocusProvider: provider,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // update user awareness
  useEffect(() => {
    if (!editor) return
    if (editor.commands.updateUser) editor.commands.updateUser(getCursorUser(user))
  }, [editor, user])

  useEffect(() => {
    if (!provider) return
    provider.setAwarenessField('user', getCursorUser(user))
  }, [provider, user])

  //awarenessUpdate handler
  useEffect(() => {
    if (!provider) return
    const awarenessUpdateHandler = (data: any) => {
      const { states }: any = data
      if (states.length === 0) return
      // if user is present, remove it from the list
      const users = states.map((user: any) => user.user)
      setWorkspaceEditorSetting('presentUsers', users)
    }

    provider.on('awarenessUpdate', awarenessUpdateHandler)

    return () => {
      if (provider) {
        provider.off('awarenessUpdate', awarenessUpdateHandler)
      }
    }
  }, [provider, user])
}

export default useProviderAwarness
