import { enableMapSet } from 'immer'
import { create } from 'zustand'

import bookmark from './bookmark'
import bootstrapStore from './bootstrapStore'
import channelMembersStore from './channelMembersStore'
import channelMessagesStore from './channelMessagesStore'
import channelPaginationStore from './channelPaginationStore'
import channelPinnedMessagesStore from './channelPinnedMessagesStore'
import channelsStore from './channelsStore'
import chatRoom from './chatroom'
import emojiPickerStore from './emojiPickerStore'
import workspaceSettingsStore from './workspaceSettingsStore'

enableMapSet()

export interface IStore
  extends
    ReturnType<typeof channelMembersStore>,
    ReturnType<typeof channelPaginationStore>,
    ReturnType<typeof channelPinnedMessagesStore>,
    ReturnType<typeof channelsStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof workspaceSettingsStore>,
    ReturnType<typeof bookmark>,
    ReturnType<typeof channelMessagesStore>,
    ReturnType<typeof emojiPickerStore>,
    ReturnType<typeof bootstrapStore> {}

export const useChatStore = create<IStore>((...props) => ({
  ...workspaceSettingsStore(...props),
  ...channelMembersStore(...props),
  ...channelMessagesStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props),
  ...bookmark(...props),
  ...emojiPickerStore(...props),
  ...channelPaginationStore(...props),
  ...bootstrapStore(...props)
}))
