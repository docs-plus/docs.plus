import { useEffect } from 'react'
import { useAuthStore, useStore } from '@stores'
import randomColor from 'randomcolor'

// Helper functions
const getCursorUser = (user: any, displayName: string | null | undefined) => {
  let bucketAddress = user?.avatar_url || null //'/assets/avatar.svg'

  if (!user) {
    return {
      name: 'Anonymous',
      displayName: 'Anonymous',
      id: 'anonymous',
      color: randomColor()
    }
  }

  return {
    name: displayName || user?.username,
    displayName: displayName || user?.username,
    avatar_url: bucketAddress,
    id: user.id,
    color: randomColor()
  }
}

const useProviderAwarness = () => {
  const user = useAuthStore((state) => state.profile)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const displayName = useAuthStore((state) => state.displayName)
  const {
    hocuspocusProvider: provider,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // update user awareness
  useEffect(() => {
    if (!editor) return
    // console.log('update user awareness', { user, displayName })
    editor.commands.updateUser(getCursorUser(user, displayName))
  }, [editor, user, displayName])

  useEffect(() => {
    if (!provider) return
    provider.setAwarenessField('user', getCursorUser(user, displayName))
  }, [provider, user, displayName])

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
