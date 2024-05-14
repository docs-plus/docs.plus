import { create } from 'zustand'
import { enableMapSet } from 'immer'

import chatRoom from './chatroom'
import channelsStore from './channelsStore'
import threadStore from './threadStore'
import channelMembersStore from './channelMembersStore'
import channelMessagesStore from './channelMessagesStore'
import workspaceSettingsStore from './workspaceSettingsStore'
import channelPinnedMessagesStore from './channelPinnedMessagesStore'

enableMapSet()

interface IStore
  extends ReturnType<typeof channelMembersStore>,
    ReturnType<typeof channelPinnedMessagesStore>,
    ReturnType<typeof channelsStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof workspaceSettingsStore>,
    ReturnType<typeof threadStore>,
    ReturnType<typeof channelMessagesStore> {}

export const useChatStore = create<IStore>((...props) => ({
  ...workspaceSettingsStore(...props),
  ...channelMembersStore(...props),
  ...channelMessagesStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props),
  ...threadStore(...props)
}))
