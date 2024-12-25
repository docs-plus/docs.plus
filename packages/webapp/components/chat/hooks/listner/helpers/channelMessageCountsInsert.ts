import { useChatStore } from '@stores'
export const channelMessageCountsInsert = (payload: any) => {
  console.log('channelMessageCountsInsert', payload)
  const updateChannelRow = useChatStore.getState().updateChannelRow
  const channel = useChatStore.getState().channels.get(payload.new.channel_id)
  console.log({ payload, channel })
  // @ts-ignore
  updateChannelRow(payload.new.channel_id, {
    ...channel,
    count: { message_count: payload.new.message_count }
  })
}
