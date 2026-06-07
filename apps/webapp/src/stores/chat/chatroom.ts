import type { Profile } from '@types'
import { immer } from 'zustand/middleware/immer'

import { useAuthStore } from '../authStore'
import { useStore } from '../useStore'

type TChatRoom = {
  headingPath: Array<any>
  headingId?: string
  documentId?: string
  open: boolean
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
  openChatRoom: () => void
  closeChatRoom: () => void
  destroyChatRoom: () => void
  setOrUpdateChatPanelHeight: (height: number) => void
  setOrUpdateChatRoom: (key: keyof TChatRoom, value: any) => void
  switchChatRoom: (channelId: string) => void
}

// Broadcast helpers - receive broadcaster to avoid circular dependency
const broadcastPresence = (broadcaster: any, user: Profile, channelId: string | null) => {
  if (!user || !broadcaster) return
  try {
    broadcaster.send?.({
      type: 'broadcast',
      event: 'presence',
      payload: { ...user, channelId }
    })
  } catch (error) {
    console.error('Failed to broadcast presence:', error)
  }
}

const chatRoom = immer<IChatroomStore>((set, get) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    open: false,
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
      broadcastPresence(broadcaster, user, headingId)
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

  openChatRoom: () => {
    set((state) => {
      state.chatRoom.open = true
    })
  },

  closeChatRoom: () => {
    set((state) => {
      state.chatRoom.open = false
    })
  },

  switchChatRoom: (channelId) => {
    set((state) => {
      state.chatRoom.headingId = channelId
    })

    const user = useAuthStore.getState().profile
    if (user) {
      const broadcaster = useStore.getState().settings?.broadcaster
      broadcastPresence(broadcaster, user, channelId)
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
        open: false,
        panelHeight: state.chatRoom.panelHeight,
        editorInstance: undefined,
        editorRef: undefined
      }
    })

    const user = useAuthStore.getState().profile
    if (user) broadcastPresence(broadcaster, user, null)
  }
}))

export default chatRoom
