import { sendPresenceBroadcast } from '@services/workspacePresenceSync'
import type { ChatPaneMode, Profile } from '@types'
import { immer } from 'zustand/middleware/immer'

import { useAuthStore } from '../authStore'
import { useStore } from '../useStore'

type TChatRoom = {
  headingPath: Array<any>
  headingId?: string
  documentId?: string
  /** Read only on mobile. Desktop sizes its docked panel from `panelHeight`. */
  paneMode: ChatPaneMode
  panelHeight: number
  replyMessageMemory?: any
  editMessageMemory?: any
  fetchMsgsFromId?: string
  editorInstance?: any
  editorRef?: any
}

interface IChatroomStore {
  chatRoom: TChatRoom
  setChatRoom: (
    headingId: string,
    documentId: string,
    headingPath: Array<any>,
    user: Profile | null,
    fetchMsgsFromId?: string
  ) => void
  updateChatRoom: (key: keyof TChatRoom, value: any) => void
  destroyChatRoom: () => void
  setPaneMode: (mode: ChatPaneMode) => void
  setOrUpdateChatPanelHeight: (height: number) => void
  setOrUpdateChatRoom: (key: keyof TChatRoom, value: any) => void
  switchChatRoom: (channelId: string) => void
}

const chatRoom = immer<IChatroomStore>((set, get) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    paneMode: 'closed',
    panelHeight: 410,
    replyMessageMemory: undefined,
    editMessageMemory: undefined,
    fetchMsgsFromId: undefined,
    editorInstance: undefined,
    editorRef: undefined
  },

  updateChatRoom: (key, value) => {
    set((state) => {
      // @ts-ignore
      state.chatRoom[key] = value
    })
  },

  setChatRoom: (headingId, documentId, headingPath, user, fetchMsgsFromId) => {
    set((state) => {
      state.chatRoom.headingId = headingId
      state.chatRoom.documentId = documentId
      state.chatRoom.headingPath = headingPath
      state.chatRoom.fetchMsgsFromId = fetchMsgsFromId
    })

    if (user) {
      const broadcaster = useStore.getState().settings?.broadcaster
      sendPresenceBroadcast(broadcaster, user, headingId)
    }
  },

  setOrUpdateChatRoom: (key, value) => {
    set((state) => {
      // @ts-ignore
      state.chatRoom[key] = value
    })
  },

  setOrUpdateChatPanelHeight: (height) => {
    set((state) => {
      state.chatRoom.panelHeight = height
    })
  },

  setPaneMode: (mode) => {
    set((state) => {
      state.chatRoom.paneMode = mode
    })
  },

  switchChatRoom: (channelId) => {
    set((state) => {
      state.chatRoom.headingId = channelId
    })

    const user = useAuthStore.getState().profile
    if (user) {
      const broadcaster = useStore.getState().settings?.broadcaster
      sendPresenceBroadcast(broadcaster, user, channelId)
    }
  },

  destroyChatRoom: () => {
    const state = get() as any
    const broadcaster = useStore.getState().settings?.broadcaster

    set((s) => {
      s.chatRoom = {
        headingId: undefined,
        documentId: undefined,
        headingPath: [],
        // Unlike panelHeight, the mode does not survive: closing unmounts the
        // chat subtree, so there is no geometry left to remember.
        paneMode: 'closed',
        panelHeight: state.chatRoom.panelHeight,
        editorInstance: undefined,
        editorRef: undefined
      }
    })

    const user = useAuthStore.getState().profile
    if (user) sendPresenceBroadcast(broadcaster, user, null)
  }
}))

export default chatRoom
