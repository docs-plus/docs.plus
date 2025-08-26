import { useAuthStore, useChatStore } from '@stores'
import { IoNotifications, IoNotificationsOff } from 'react-icons/io5'
import { RiAtLine } from 'react-icons/ri'
import { updateChannelNotifState, getChannelNotifState } from '@api'
import { useApi } from '@hooks/useApi'
import Button from '@components/ui/Button'
import { useState, useCallback, useEffect } from 'react'
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

  const {
    request: updateNotifState,
    loading: updateLoading,
    error: updateError
  } = useApi(updateChannelNotifState, null, false)
  const {
    request: fetchNotifState,
    loading: fetchLoading,
    error: fetchError
  } = useApi(getChannelNotifState, null, false)

  useEffect(() => {
    if (!chatRoom?.headingId) return

    fetchNotifState({
      _channel_id: chatRoom.headingId
    }).then(({ data }) => {
      setNotificationState((data as NotificationState) ?? 'MENTIONS')
    })
  }, [chatRoom?.headingId, fetchNotifState])

  const handleToggle = useCallback(async () => {
    if (!chatRoom?.headingId || !user?.id) return

    const nextState = getNextNotificationState(notificationState)
    setNotificationState(nextState)

    const { error: apiError } = await updateNotifState({
      channelId: chatRoom.headingId,
      memberId: user.id,
      notifState: nextState
    })

    if (apiError) {
      setNotificationState(notificationState)
      console.error('Failed to update notification state:', apiError)
    }
  }, [chatRoom?.headingId, user?.id, notificationState, updateNotifState])

  return {
    notificationState,
    loading: fetchLoading || updateLoading,
    error: fetchError || updateError,
    handleToggle
  }
}

export const NotificationToggle = ({ className }: { className?: string }) => {
  const { notificationState, loading, handleToggle } = useNotificationToggle()

  const notificationIcons = {
    ALL: <IoNotifications size={18} />,
    MENTIONS: <RiAtLine size={18} />,
    MUTED: <IoNotificationsOff size={18} />
  }

  return (
    <Button
      loading={loading}
      onClick={handleToggle}
      className={`btn btn-sm btn-square btn-ghost tooltip tooltip-left flex items-center ${className} `}
      data-tip={`Notifications: ${notificationState}`}>
      {notificationIcons[notificationState]}
    </Button>
  )
}
