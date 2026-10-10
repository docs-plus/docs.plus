import { AvatarStack } from '@components/ui/AvatarStack'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
}

/** Presence never waits on the feed, so the stack paints at once and has no loader. */
export const ParticipantsList = ({ className }: Props) => {
  const headingId = useChatStore((state) => state.chatRoom?.headingId ?? '')
  const presentUsers = usePresentUsers(headingId)

  if (!presentUsers.length) return null

  return (
    <div className={twMerge('flex items-center', className)}>
      <AvatarStack size="sm" users={presentUsers} showActivity tooltipPlacement="bottom" />
    </div>
  )
}
