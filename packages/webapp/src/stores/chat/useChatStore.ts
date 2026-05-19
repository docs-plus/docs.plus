import { enableMapSet } from 'immer'
import { create } from 'zustand'

import bookmark from './bookmark'
import bootstrapStore from './bootstrapStore'
import channelMembersStore from './channelMembersStore'
import channelPinnedMessagesStore from './channelPinnedMessagesStore'
import channelsStore from './channelsStore'
import chatRoom from './chatroom'
import emojiPickerStore from './emojiPickerStore'
import opticalUnreadStore from './opticalUnreadStore'
import peerReadCursorStore from './peerReadCursorStore'
import workspaceSettingsStore from './workspaceSettingsStore'

enableMapSet()

export interface IStore
  extends
    ReturnType<typeof channelMembersStore>,
    ReturnType<typeof channelPinnedMessagesStore>,
    ReturnType<typeof channelsStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof workspaceSettingsStore>,
    ReturnType<typeof bookmark>,
    ReturnType<typeof emojiPickerStore>,
    ReturnType<typeof opticalUnreadStore>,
    ReturnType<typeof peerReadCursorStore>,
    ReturnType<typeof bootstrapStore> {}

export const useChatStore = create<IStore>((...props) => ({
  ...workspaceSettingsStore(...props),
  ...channelMembersStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props),
  ...bookmark(...props),
  ...emojiPickerStore(...props),
  ...opticalUnreadStore(...props),
  ...peerReadCursorStore(...props),
  ...bootstrapStore(...props)
}))
