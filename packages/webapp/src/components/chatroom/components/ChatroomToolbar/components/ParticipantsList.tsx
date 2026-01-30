import AvatarStack from '@components/AvatarStack'
import { useChatStore, useStore } from '@stores'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const ParticipantsList = ({ className }: Props) => {
  const [presentUsers, setPresentUsers] = useState<any>([])
  const chatRoom = useChatStore((state) => state.chatRoom)
  const usersPresence = useStore((state) => state.usersPresence)

  useEffect(() => {
    if (!chatRoom) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers)
      .filter((user) => user?.channelId === chatRoom.headingId)
      .filter((user) => user?.status !== 'OFFLINE')

    setPresentUsers(users)
  }, [usersPresence, chatRoom])

  if (!presentUsers.length) return null

  return (
    <div className={twMerge('flex items-center', className)}>
      <AvatarStack
        size="sm"
        users={presentUsers}
        showStatus={true}
        tooltipPosition="tooltip-bottom"
      />
    </div>
  )
}
