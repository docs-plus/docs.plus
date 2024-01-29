/* eslint-disable no-use-before-define */
// @ts-nocheck
import { useEffect, useState } from 'react'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { groupedMessages } from '@utils/groupMessages'
import { fetchChannelInitialData, CreateChannel } from '@api'
import slugify from 'slugify'

interface UseChannelInitialData {
  initialMessagesLoading: boolean
  msgLength: number
}

export const useChannelInitialData = (setError: (error: any) => void): UseChannelInitialData => {
  const [initialMessagesLoading, setInitialMessagesLoading] = useState<boolean>(true)
  const [msgLength, setMsgLength] = useState<number>(0)
  const { headingId: channelId, documentId: workspaceId } = useChatStore((state) => state.chatRoom)

  const bulkSetChannelPinnedMessages = useChatStore(
    (state: any) => state.bulkSetChannelPinnedMessages
  )
  const bulkSetMessages = useChatStore((state: any) => state.bulkSetMessages)
  const setWorkspaceSetting = useChatStore((state: any) => state.setWorkspaceSetting)
  const setOrUpdateChannel = useChatStore((state: any) => state.setOrUpdateChannel)
  const currentChannel = useChatStore((state: any) => state.channels.get(channelId))
  const bulkSetChannelMembers = useChatStore((state: any) => state.bulkSetChannelMembers)
  const user = useAuthStore((state: any) => state.profile)

  // first check if the channel already exists in the store
  // if it does not exsit, create a new channel
  // if it exists, update the channel

  const processChannelData = async (channelId: string) => {
    if (!currentChannel && workspaceId) {
      let newChannelId = channelId
      if ('' + newChannelId === '1') newChannelId = `1_${workspaceId}`
      const data = await CreateChannel({
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

    updateChannelState(channelData)
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

  const updateChannelState = (channelData: any) => {
    if (channelData.member_count) {
      setOrUpdateChannel(channelId, { ...currentChannel, member_count: channelData.member_count })
    }

    bulkSetChannelMembers(channelId, channelData.channel_members || [])

    // if (channelData.is_user_channel_member) {
    //   setWorkspaceSetting('isUserChannelMember', channelData.is_user_channel_member)
    // }

    // if (channelData.channel_info) {
    //   setWorkspaceSetting('channelInfo', channelData.channel_info)
    // }

    if (channelData.pinned_messages) {
      bulkSetChannelPinnedMessages(channelId, channelData.pinned_messages)
    }

    if (channelData.last_messages) {
      const newMessages = groupedMessages(channelData.last_messages.reverse())
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
