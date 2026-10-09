import { getChannelNotifState, updateChannelNotifState } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore } from '@stores'
import { useCallback, useEffect, useState } from 'react'

type NotificationState = 'ALL' | 'MENTIONS' | 'MUTED'

const getNextNotificationState = (current: NotificationState): NotificationState => {
  const states: Record<NotificationState, NotificationState> = {
    ALL: 'MENTIONS',
    MENTIONS: 'MUTED',
    MUTED: 'ALL'
  }
  return states[current]
}

export const useNotificationToggle = () => {
  // The resolved row, never the heading id (#402). A heading with no row has no setting.
  const channelId = useChatStore((state) => state.chatRoom.channelId)
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
    if (!channelId) return

    fetchNotifState({
      _channel_id: channelId
    }).then(({ data }) => {
      setNotificationState((data as NotificationState) ?? 'MENTIONS')
    })
    // `user?.id` is a dependency because this state is per person. A background
    // sign-in would otherwise leave the anonymous answer on screen.
  }, [channelId, fetchNotifState, user?.id])

  const handleToggle = useCallback(async () => {
    if (!channelId || !user?.id) return

    const nextState = getNextNotificationState(notificationState)
    setNotificationState(nextState)

    const { error: apiError } = await updateNotifState({
      channelId,
      memberId: user.id,
      notifState: nextState
    })

    if (apiError) {
      setNotificationState(notificationState)
      console.error('Failed to update notification state:', apiError)
    }
  }, [channelId, user?.id, notificationState, updateNotifState])

  return {
    notificationState,
    loading: fetchLoading || updateLoading,
    fetchLoading,
    error: fetchError || updateError,
    handleToggle
  }
}
