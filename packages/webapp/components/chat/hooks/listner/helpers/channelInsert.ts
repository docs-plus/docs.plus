import { useChatStore } from '@stores'

export const channelInsert = (payload: any) => {
  const setOrUpdateChannel = useChatStore.getState().setOrUpdateChannel
  setOrUpdateChannel(payload.new.id, payload.new)
}
