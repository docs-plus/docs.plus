import { useAuthStore, useChatStore } from '@stores'
import { IoNotifications, IoNotificationsOff } from 'react-icons/io5'
import { RiAtLine } from 'react-icons/ri'
import { updateChannelNotifState } from '@api'
import { useApi } from '@hooks/useApi'
import Button from '@components/ui/Button'
import { useState, useCallback } from 'react'

type NotificationState = 'ALL' | 'MENTIONS' | 'MUTED'

const getNextNotificationState = (current: NotificationState): NotificationState => {
  const states: Record<NotificationState, NotificationState> = {
    ALL: 'MENTIONS',
    MENTIONS: 'MUTED',
    MUTED: 'ALL'
  }
  return states[current]
}

const useNotificationToggle = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const user = useAuthStore((state) => state.profile)
  const [notificationState, setNotificationState] = useState<NotificationState>('MENTIONS')
  const { request, loading, error } = useApi(updateChannelNotifState, null, false)

  const handleToggle = useCallback(async () => {
    if (!chatRoom?.headingId || !user?.id) return

    const nextState = getNextNotificationState(notificationState)
    setNotificationState(nextState)

    const { error: apiError } = await request({
      channelId: chatRoom.headingId,
      memberId: user.id,
      notifState: nextState
    })

    if (apiError) {
      // Revert state if API call fails
      setNotificationState(notificationState)
      console.error('Failed to update notification state:', apiError)
    }
  }, [chatRoom?.headingId, user?.id, notificationState, request])

  return {
    notificationState,
    loading,
    error,
    handleToggle
  }
}

export const NotificationToggle = () => {
  const { notificationState, loading, handleToggle } = useNotificationToggle()

  const notificationIcons = {
    ALL: <IoNotifications size={18} />,
    MENTIONS: <RiAtLine size={18} />,
    MUTED: <IoNotificationsOff size={18} />
  }

  return (
    <div
      className="tooltip tooltip-left flex items-center"
      data-tip={`Notifications: ${notificationState}`}>
      <Button
        loading={loading}
        onClick={handleToggle}
        className="btn btn-ghost btn-xs px-1 hover:bg-indigo-500 hover:text-white">
        {notificationIcons[notificationState]}
      </Button>
    </div>
  )
}
