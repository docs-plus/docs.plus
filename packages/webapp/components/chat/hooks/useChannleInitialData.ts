import { useEffect, useMemo, useState, useCallback } from 'react'
import { useChatStore, useAuthStore, useStore } from '@stores'
import { groupedMessages } from '@utils/index'
import { fetchChannelInitialData, upsertChannel } from '@api'
import { useChannel } from '../context/ChannelProvider'
import slugify from 'slugify'
import { TChannelSettings } from '@types'
import { join2Channel } from '@api'
import Config from '@config'
import debounce from 'lodash/debounce'

interface UseChannelInitialData {
  isChannelDataLoaded: boolean
  msgLength: number
}

export const useChannelInitialData = (setError: (error: any) => void): UseChannelInitialData => {
  const { channelId } = useChannel()

  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState<boolean>(false)
  const [msgLength, setMsgLength] = useState<number>(0)
  const {
    metadata: { documentId: workspaceId }
  } = useStore((state) => state.settings)

  const bulkSetChannelPinnedMessages = useChatStore(
    (state: any) => state.bulkSetChannelPinnedMessages
  )
  const bulkSetMessages = useChatStore((state) => state.bulkSetMessages)
  const clearChannelMessages = useChatStore((state) => state.clearChannelMessages)
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
    if (currentChannel === null && workspaceId) {
      let newChannelId = channelId
      const userId = user?.id || Config.chat.systemUserId
      await upsertChannel({
        id: newChannelId,
        workspace_id: workspaceId,
        created_by: userId,
        name: slugify(newChannelId, { strict: true, lower: true }),
        slug: 'c' + slugify(newChannelId, { strict: true, lower: true })
      })
    }

    let fetchArgs: any = { input_channel_id: channelId, message_limit: 20 }

    const startMsgId =
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(location.search).get('msg_id')

    if (startMsgId) {
      fetchArgs = {
        ...fetchArgs,
        anchor_message_id: startMsgId
      }
    }

    const { data: channelData, error: channelError } = await fetchChannelInitialData(fetchArgs)

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

  const fetchInitialData = async () => {
    setIsChannelDataLoaded(false)
    try {
      await processChannelData(channelId)
    } catch (error) {
      console.error(error)
      setError(error)
    } finally {
      setIsChannelDataLoaded(true)
    }
  }

  // Use lodash debounce
  const debouncedFetchData = useCallback(
    debounce(() => {
      fetchInitialData()
    }, 300),
    [channelId]
  )

  useEffect(() => {
    if (!channelId) return

    debouncedFetchData()

    return () => {
      debouncedFetchData.cancel()
    }
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
      // TODO: if the channel is already loaded with anchor messages, we need to clear the channel messages
      // TODO: and then set the new messages // Refactor needed

      clearChannelMessages(channelId)
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
    isChannelDataLoaded,
    msgLength
  }
}
