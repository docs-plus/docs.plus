import { useEffect, useMemo, useState } from 'react'
import { useChatStore, useAuthStore } from '@stores'
import { groupedMessages } from '@utils/index'
import { fetchChannelInitialData, upsertChannel } from '@api'
import { useChannel } from '../context/ChannelProvider'
import slugify from 'slugify'
import { TChannelSettings } from '@types'
import { join2Channel } from '@api'

interface UseChannelInitialData {
  initialMessagesLoading: boolean
  msgLength: number
}

export const useChannelInitialData = (setError: (error: any) => void): UseChannelInitialData => {
  const { channelId } = useChannel()

  const [initialMessagesLoading, setInitialMessagesLoading] = useState<boolean>(true)
  const [msgLength, setMsgLength] = useState<number>(0)
  const { documentId: workspaceId } = useChatStore((state) => state.chatRoom)
  const bulkSetChannelPinnedMessages = useChatStore(
    (state: any) => state.bulkSetChannelPinnedMessages
  )
  const bulkSetMessages = useChatStore((state) => state.bulkSetMessages)
  const setWorkspaceChannelSetting = useChatStore((state) => state.setWorkspaceChannelSetting)
  const setLastMessage = useChatStore((state) => state.setLastMessage)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const currentChannel = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )
  const addChannelMember = useChatStore((state) => state.addChannelMember)
  const user = useAuthStore((state: any) => state.profile)
  const setOrUpdateChannel = useChatStore((state: any) => state.setOrUpdateChannel)

  const processChannelData = async (channelId: string) => {
    if (currentChannel === null && workspaceId && user) {
      let newChannelId = channelId
      await upsertChannel({
        id: newChannelId,
        workspace_id: workspaceId,
        created_by: user.id,
        name: newChannelId,
        slug: 'c' + slugify(newChannelId, { strict: true, lower: true })
      })
    }
    const { data: channelData, error: channelError } = await fetchChannelInitialData({
      input_channel_id: channelId,
      message_limit: 20
    })

    if (channelError) throw new Error(channelError.message)

    setOrUpdateChannel(channelId, channelData.channel_info)

    setWorkspaceChannelSetting(
      channelId,
      'scrollPageOffset',
      channelData?.total_messages_since_last_read >= 20
        ? channelData?.total_messages_since_last_read
        : 20
    )
    setWorkspaceChannelSetting(channelId, 'unreadMessage', channelData?.unread_message)
    setWorkspaceChannelSetting(channelId, 'lastReadMessageId', channelData?.last_read_message_id)
    setWorkspaceChannelSetting(
      channelId,
      'lastReadMessageTimestamp',
      channelData?.last_read_message_timestamp
    )
    setWorkspaceChannelSetting(
      channelId,
      'totalMsgSincLastRead',
      channelData?.total_messages_since_last_read
    )

    await updateChannelState(channelData)
  }

  useEffect(() => {
    if (!channelId) return

    async function fetchInitialData() {
      setInitialMessagesLoading(true)
      try {
        await processChannelData(channelId)
      } catch (error) {
        console.error(error)
        setError(error)
      } finally {
        setInitialMessagesLoading(false)
      }
    }

    fetchInitialData()
  }, [channelId])

  const updateChannelState = async (channelData: any) => {
    const userId = useAuthStore.getState()?.session?.id || ''

    if (channelData.channel_member_info) {
      addChannelMember(channelId, {
        ...channelData.channel_member_info,
        id: userId
      })
    }
    // TODO: refactor/revise needed
    if (userId && !channelData.is_user_channel_member) {
      // join channel
      await join2Channel({
        channel_id: channelId,
        member_id: userId
      }).catch((error) => {
        console.error('[useChannelInitialData] join2Channel error', error)
        throw error
      })

      addChannelMember(channelId, {
        ...channelData.channel_member_info,
        id: userId
      })
      channelData.is_user_channel_member = true
    }

    setWorkspaceChannelSetting(
      channelId,
      'isUserChannelMember',
      channelData?.is_user_channel_member || false
    )

    if (channelData.channel_info) {
      setWorkspaceChannelSetting(channelId, 'channelInfo', channelData.channel_info)
    }

    if (channelData.pinned_messages) {
      bulkSetChannelPinnedMessages(channelId, channelData.pinned_messages)
    }

    if (channelData.last_messages) {
      const newMessages = groupedMessages(channelData.last_messages.reverse())
      const lastMessage = newMessages.at(-1)
      setLastMessage(channelId, lastMessage)
      bulkSetMessages(channelId, newMessages)
      setMsgLength(newMessages.length)
    } else {
      setMsgLength(0)
    }
  }

  return {
    initialMessagesLoading,
    msgLength
  }
}
