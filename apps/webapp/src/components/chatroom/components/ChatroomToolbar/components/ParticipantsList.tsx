import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { AvatarStack } from '@components/ui/AvatarStack'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
}

export const ParticipantsList = ({ className }: Props) => {
  const { error, isFeedReady } = useChatroomContext()
  const headingId = useChatStore((state) => state.chatRoom?.headingId ?? '')
  const presentUsers = usePresentUsers(headingId)

  if (!isFeedReady && !error) {
    return (
      <div className={twMerge('flex items-center', className)} aria-hidden>
        <AvatarStackLoader size="sm" repeat={2} />
      </div>
    )
  }

  if (!presentUsers.length) return null

  return (
    <div className={twMerge('flex items-center', className)}>
      <AvatarStack size="sm" users={presentUsers} showActivity tooltipPlacement="bottom" />
    </div>
  )
}
