import { immer } from 'zustand/middleware/immer'
import { Database } from '@types'
import { useAuthStore, useStore } from '@stores'

export type TProfile = Database['public']['Tables']['users']['Row'] & {
  channelId?: string | null
}

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
  setChatRoom: (
    headingId: string,
    documentId: string,
    headingPath: Array<Object>,
    user: TProfile
  ) => void
  openChatRoom: () => void
  closeChatRoom: () => void
  destroyChatRoom: () => void
  setOrUpdateChatPannelHeight: (height: number) => void
  setOrUpdateChatRoom: (key: keyof TChatRoom, value: any) => void
}

const getWorkspaceId = (): string => {
  return useStore.getState().settings.workspaceId || ''
}

const join2Channel = (user: TProfile, channelId: string) => {
  useStore.getState().settings.broadcaster.send({
    type: 'broadcast',
    event: 'presence',
    payload: { ...user, channelId }
  })
}

const leaveChannel = (user: TProfile) => {
  useStore.getState().settings.broadcaster.send({
    type: 'broadcast',
    event: 'presence',
    payload: { ...user, channelId: null }
  })
}

const chatRoom = immer<IChatroomStore>((set) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    open: false,
    pannelHeight: 300,
    userPickingEmoji: undefined,
    replayMessageMemory: undefined,
    editeMessageMemory: undefined
  },

  setChatRoom: (headingId, documentId, headingPath, user) => {
    let newHeadingId: string = headingId
    if (+newHeadingId === 1) newHeadingId = `1_${documentId}`
    set((state) => {
      state.chatRoom.headingId = newHeadingId
      state.chatRoom.documentId = documentId
      state.chatRoom.headingPath = headingPath
    })

    join2Channel(user, newHeadingId)
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
    const user = useAuthStore.getState().profile
    if (!user) return
    leaveChannel(user)
  }
}))

export default chatRoom
