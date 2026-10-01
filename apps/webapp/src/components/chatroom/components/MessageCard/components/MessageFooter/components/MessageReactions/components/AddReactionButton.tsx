import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { openMessageReactionAt } from '@components/chatroom/utils/messageReaction'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useCallback, useMemo } from 'react'

type Props = {
  className?: string
}
const AddReactionButton = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const user = useAuthStore((state) => state.profile)
  const member = useChatStore((state) => state.channelMembers.get(message.channel_id))
  // User can only react if they are a member of the channel
  const canUserReact = useMemo(() => user && member?.get(user?.id), [user, member])

  const openEmojiPickerHandler = useCallback(
    (event: React.MouseEvent) =>
      openMessageReactionAt(message, (event.target as HTMLElement).getBoundingClientRect()),
    [message]
  )

  if (!canUserReact || Object.keys(message.reactions || {}).length === 0) return null

  return (
    <button
      type="button"
      aria-label="Add reaction"
      className={twMerge(
        'badge bg-base-300 group focus-visible:ring-primary cursor-pointer overflow-hidden border-none !p-0 focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      onClick={openEmojiPickerHandler}>
      <span className="group-hover:bg-base-content/10 flex h-full items-center px-2 transition-colors">
        <Icons.emojiAdd size={14} aria-hidden />
      </span>
    </button>
  )
}

export default AddReactionButton
