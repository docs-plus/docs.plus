import { create } from 'zustand'
import { enableMapSet } from 'immer'

import channelMembersStore from './channelMembersStore'
import channelMessagesStore from './channelMessagesStore'
import channelPinnedMessagesStore from './channelPinnedMessagesStore'
import channelsStore from './channelsStore'
import chatRoom from './chatroom'

enableMapSet()

interface IStore
  extends ReturnType<typeof channelMembersStore>,
    ReturnType<typeof channelPinnedMessagesStore>,
    ReturnType<typeof channelsStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof channelMessagesStore> {}

export const useChatStore = create<IStore>((...props) => ({
  ...channelMembersStore(...props),
  ...channelMessagesStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props)
}))
