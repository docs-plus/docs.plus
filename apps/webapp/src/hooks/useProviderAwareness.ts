import { useAuthStore, useStore } from '@stores'
import { getCursorUser } from '@utils/getCursorUser'
import { useEffect } from 'react'

// Single awareness writer: updateUser routes through the caret plugin's
// awareness field, so a parallel provider.setAwarenessField('user') only
// double-broadcast a competing payload.
const useProviderAwareness = () => {
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!editor) return
    if (editor.commands.updateUser) editor.commands.updateUser(getCursorUser(user))
  }, [editor, user])
}

export default useProviderAwareness
