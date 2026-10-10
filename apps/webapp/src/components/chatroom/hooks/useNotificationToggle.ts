import { getChannelNotifState, updateChannelNotifState } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
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
  // A failed channel resolve leaves the row undefined, so the room error ends the bone.
  const { error: roomError } = useChatroomContext()
  const [notificationState, setNotificationState] = useState<NotificationState>('MENTIONS')
  // The channel and person whose read has settled. Until then, and while the row still
  // resolves (undefined), the toggle shows its bone. useApi's loading turns on only after paint.
  const [readFor, setReadFor] = useState<string | null>(null)
  const readKey = `${channelId}:${user?.id ?? ''}`

  const {
    request: updateNotifState,
    loading: updateLoading,
    error: updateError
  } = useApi(updateChannelNotifState, null, false)
  const { request: fetchNotifState, error: fetchError } = useApi(getChannelNotifState, null, false)
  const fetchLoading = !roomError && channelId !== null && readFor !== readKey

  useEffect(() => {
    if (!channelId) return

    fetchNotifState({
      _channel_id: channelId
    })
      .then(({ data }) => {
        setNotificationState((data as NotificationState) ?? 'MENTIONS')
      })
      // useApi logs and rethrows. A failed read keeps the default state.
      .catch(() => {})
      .finally(() => setReadFor(readKey))
    // `readKey` holds `user?.id`, because this state is per person. A background
    // sign-in would otherwise leave the anonymous answer on screen.
  }, [channelId, fetchNotifState, readKey])

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
