import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'

export const EditAction = () => {
  const { message } = useMessageCardContext()
  const { editMessageHandler } = useEditMessageHandler()
  const profile = useAuthStore((state) => state.profile)

  const isOwner = useMemo(() => {
    return message?.user_id === profile?.id
  }, [message, profile])

  if (!isOwner) return null

  return (
    <li>
      <a className="flex items-center gap-2" onClick={() => editMessageHandler(message)}>
        <Icons.edit size={20} />
        Edit Message
      </a>
    </li>
  )
}
