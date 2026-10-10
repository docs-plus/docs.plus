import { getChannelNotifState, updateChannelNotifState } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore } from '@stores'
import { useQuery, useQueryClient } from '@tanstack/react-query'

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
  const userId = useAuthStore((state) => state.profile?.id)
  // A failed channel resolve leaves the row undefined, so the room error ends the bone.
  const { error: roomError } = useChatroomContext()
  const queryClient = useQueryClient()
  // The state is per person, so a background sign-in does not keep the anonymous answer.
  const queryKey = ['channel-notif-state', channelId, userId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<NotificationState> => {
      const { data, error } = await getChannelNotifState({ _channel_id: channelId as string })
      if (error) throw error
      return (data as NotificationState) ?? 'MENTIONS'
    },
    // A visitor has no setting and the toggle hides, so the read never runs for one.
    enabled: Boolean(channelId && userId),
    // A failed read keeps the default state at once, so the bone ends.
    retry: false
  })
  const notificationState = data ?? 'MENTIONS'
  // A disabled query is not loading, so an unresolved row (undefined) keeps the bone too.
  const fetchLoading = !roomError && (channelId === undefined || isLoading)

  const { request: updateNotifState, loading: updateLoading } = useApi(
    updateChannelNotifState,
    null,
    false
  )

  const handleToggle = async () => {
    if (!channelId || !userId) return

    const nextState = getNextNotificationState(notificationState)
    // A focus refetch in flight would overwrite the optimistic state.
    await queryClient.cancelQueries({ queryKey })
    queryClient.setQueryData(queryKey, nextState)

    try {
      await updateNotifState({ channelId, memberId: userId, notifState: nextState })
    } catch {
      // useApi logs and rethrows, so the old state comes back here.
      queryClient.setQueryData(queryKey, notificationState)
    }
  }

  return {
    notificationState,
    loading: fetchLoading || updateLoading,
    fetchLoading,
    handleToggle
  }
}
