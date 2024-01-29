import { useStore, useChatStore } from '@stores'

export const channelUpdate = (payload: any) => {
  const setOrUpdateChannel = useChatStore.getState().setOrUpdateChannel

  setOrUpdateChannel(payload.new.id, payload.new)
}
