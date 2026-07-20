import AvatarStack from '@components/AvatarStack'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const ParticipantsList = ({ className }: Props) => {
  const { isFeedReady } = useChatroomContext()
  const headingId = useChatStore((state) => state.chatRoom?.headingId ?? '')
  const presentUsers = usePresentUsers(headingId)

  if (!isFeedReady) {
    return (
      <div className={twMerge('flex items-center', className)} aria-hidden>
        <AvatarStackLoader size="sm" repeat={2} />
      </div>
    )
  }

  if (!presentUsers.length) return null

  return (
    <div className={twMerge('flex items-center', className)}>
      <AvatarStack size="sm" users={presentUsers} showStatus tooltipPosition="bottom" />
    </div>
  )
}
