import { enableMapSet } from 'immer'
import { create } from 'zustand'

import bookmark from './bookmark'
import channelMembersStore from './channelMembersStore'
import channelMessagesStore from './channelMessagesStore'
import channelPinnedMessagesStore from './channelPinnedMessagesStore'
import channelsStore from './channelsStore'
import chatRoom from './chatroom'
import emojiPickerStore from './emojiPickerStore'
import threadStore from './threadStore'
import workspaceSettingsStore from './workspaceSettingsStore'

enableMapSet()

interface IStore
  extends
    ReturnType<typeof channelMembersStore>,
    ReturnType<typeof channelPinnedMessagesStore>,
    ReturnType<typeof channelsStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof workspaceSettingsStore>,
    ReturnType<typeof threadStore>,
    ReturnType<typeof bookmark>,
    ReturnType<typeof channelMessagesStore>,
    ReturnType<typeof emojiPickerStore> {}

export const useChatStore = create<IStore>((...props) => ({
  ...workspaceSettingsStore(...props),
  ...channelMembersStore(...props),
  ...channelMessagesStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props),
  ...threadStore(...props),
  ...bookmark(...props),
  ...emojiPickerStore(...props)
}))
