import { fetchChannelInitialData, upsertChannel } from '@api'
import { joinChannel } from '@api'
import Config from '@config'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { TChannelSettings } from '@types'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useState } from 'react'
import slugify from 'slugify'

interface UseChannelInitialData {
  isChannelDataLoaded: boolean
  msgLength: number
}

export const useChannelInitialData = (
  setError: (error: any) => void,
  channelId: string
): UseChannelInitialData => {
  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState<boolean>(false)
  const [msgLength, setMsgLength] = useState<number>(0)
  const workspaceId = useStore((state) => state.settings.metadata?.documentId)

  const bulkSetChannelPinnedMessages = useChatStore(
    (state: any) => state.bulkSetChannelPinnedMessages
  )
  const bulkSetMessages = useChatStore((state) => state.bulkSetMessages)
  const clearChannelMessages = useChatStore((state) => state.clearChannelMessages)
  const setWorkspaceChannelSetting = useChatStore((state) => state.setWorkspaceChannelSetting)
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
      const userId = user?.id || Config.chat.systemUserId
      const slug = slugify(channelId, { strict: true, lower: true })
      await upsertChannel({
        id: channelId,
        workspace_id: workspaceId,
        created_by: userId,
        name: slug,
        slug: 'c' + slug
      })
    }

    const startMsgId =
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(location.search).get('msg_id')

    const fetchArgs: any = {
      input_channel_id: channelId,
      message_limit: 20,
      ...(startMsgId && { anchor_message_id: startMsgId })
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
      'totalMsgSinceLastRead',
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  const updateChannelState = async (channelData: any) => {
    // Use profile.id (not session.id) — profile only exists for real users
    // who have a row in public.users. Anonymous/stale sessions have a session
    // UUID that does NOT exist in public.users, causing FK violations.
    const userId = useAuthStore.getState()?.profile?.id || ''

    if (userId && channelData.channel_member_info) {
      addChannelMember(channelId, {
        ...channelData.channel_member_info,
        id: userId
      })
    }
    // TODO: refactor/revise needed
    if (userId && !channelData.is_user_channel_member) {
      await joinChannel({
        channel_id: channelId,
        member_id: userId
      }).catch((error) => {
        console.error('[useChannelInitialData] joinChannel error', error)
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
      const newMessages = [...channelData.last_messages].reverse()
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
