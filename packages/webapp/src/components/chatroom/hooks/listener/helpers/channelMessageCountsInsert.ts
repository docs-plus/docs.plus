import { useChatStore } from '@stores'

export const channelMessageCountsInsert = (payload: any) => {
  const updateChannelRow = useChatStore.getState().updateChannelRow
  const channelId = payload.new.channel_id
  const channel = useChatStore.getState().channels.get(channelId)

  if (!channel) return

  updateChannelRow(channelId, {
    ...channel,
    unread_message_count: payload.new.message_count
  })
}
