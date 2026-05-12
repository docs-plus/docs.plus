import { useChatStore } from '@stores'
import type { Channel as TChannel } from '@types'

export const channelUpsert = (payload: { new: NonNullable<TChannel> }) => {
  const setOrUpdateChannel = useChatStore.getState().setOrUpdateChannel
  setOrUpdateChannel(payload.new.id, payload.new)
}
