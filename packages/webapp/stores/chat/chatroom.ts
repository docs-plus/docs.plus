import { immer } from 'zustand/middleware/immer'
import { Database } from '@types'
import { useStore } from '@stores'
export type TProfile = Database['public']['Tables']['users']['Row']

type TChatRoom = {
  headingPath: Array<Object>
  headingId?: string
  documentId?: string
  open: boolean
  pannelHeight: number
  userPickingEmoji?: any
  replayMessageMemory?: any
  editeMessageMemory?: any
}

interface IChatroomStore {
  chatRoom: TChatRoom
  setChatRoom: (headingId: string, documentId: string, headingPath: Array<Object>) => void
  openChatRoom: () => void
  closeChatRoom: () => void
  destroyChatRoom: () => void
  setOrUpdateChatPannelHeight: (height: number) => void
  setOrUpdateChatRoom: (key: keyof TChatRoom, value: any) => void
  setReplayMessageMemory: (message: any) => void
  setEditeMessageMemory: (message: any) => void
}

const getWorkspaceId = () => {
  return useStore.getState().settings.workspaceId
}

const chatRoom = immer<IChatroomStore>((set) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    open: false,
    pannelHeight: 300,
    userPickingEmoji: undefined
  },

  setReplayMessageMemory: (message) => {
    set((state) => {
      state.chatRoom.replayMessageMemory = message
    })
  },

  setEditeMessageMemory: (message) => {
    set((state) => {
      state.chatRoom.editeMessageMemory = message
    })
  },

  setChatRoom: (headingId, documentId, headingPath) => {
    let newHeadingId: string = headingId
    if (+newHeadingId === 1) newHeadingId = `1_${documentId}`
    set((state) => {
      state.chatRoom.headingId = newHeadingId
      state.chatRoom.documentId = documentId
      state.chatRoom.headingPath = headingPath
    })
  },

  setOrUpdateChatRoom: (key, value) => {
    if (key === 'headingId') {
      let newHeadingId: string = value
      if (+newHeadingId === 1) newHeadingId = `1_${getWorkspaceId()}`
      value = newHeadingId
    }
    set((state) => {
      // @ts-ignore
      state.chatRoom[key] = value
    })
  },

  setOrUpdateChatPannelHeight: (height) => {
    set((state) => {
      state.chatRoom.pannelHeight = height
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

  destroyChatRoom: () => {
    set((state) => {
      state.chatRoom = {
        headingId: undefined,
        documentId: undefined,
        headingPath: [],
        open: false,
        pannelHeight: 300
      }
    })
  }
}))

export default chatRoom
