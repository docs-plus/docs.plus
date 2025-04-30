import { immer } from 'zustand/middleware/immer'
import { Database, Profile } from '@types'
import { useAuthStore, useChatStore, useStore } from '@stores'

type TChatRoom = {
  headingPath: Array<any>
  headingId?: string
  documentId?: string
  open: boolean
  pannelHeight: number
  userPickingEmoji?: any
  replayMessageMemory?: any
  editeMessageMemory?: any
  fetchMsgsFromId?: string
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
  setOrUpdateChatPannelHeight: (height: number) => void
  setOrUpdateChatRoom: (key: keyof TChatRoom, value: any) => void
  switchChatRoom: (channelId: string) => void
}

const getWorkspaceId = (): string => {
  return useStore.getState().settings.workspaceId || ''
}

const join2Channel = (user: Profile, channelId: string) => {
  if (!user) return
  useStore.getState().settings?.broadcaster.send({
    type: 'broadcast',
    event: 'presence',
    payload: { ...user, channelId }
  })
}

const leaveChannel = (user: Profile): void => {
  if (!user) return

  const broadcaster = useStore.getState().settings?.broadcaster
  try {
    broadcaster?.send?.({
      type: 'broadcast',
      event: 'presence',
      payload: { ...user, channelId: null }
    })
  } catch (error) {
    console.error('Failed to leave channel:', error)
  }
}

const switchChannel = (user: Profile, newChannelId: string): void => {
  if (!user) return

  const broadcaster = useStore.getState().settings?.broadcaster
  try {
    broadcaster?.send?.({
      type: 'broadcast',
      event: 'presence',
      payload: { ...user, channelId: newChannelId }
    })
  } catch (error) {
    console.error('Failed to leave channel:', error)
  }
}

const chatRoom = immer<IChatroomStore>((set) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    open: false,
    pannelHeight: 410,
    userPickingEmoji: undefined,
    replayMessageMemory: undefined,
    editeMessageMemory: undefined,
    commentMessageMemory: undefined,
    fetchMsgsFromId: undefined
  },

  updateChatRoom: (key, value) => {
    set((state) => {
      // @ts-ignore
      state.chatRoom[key] = value
    })
  },

  setChatRoom: (headingId, documentId, headingPath, user, fetchMsgsFromId) => {
    let newHeadingId: string = headingId
    set((state) => {
      state.chatRoom.headingId = newHeadingId
      state.chatRoom.documentId = documentId
      state.chatRoom.headingPath = headingPath
      state.chatRoom.fetchMsgsFromId = fetchMsgsFromId
    })

    if (user) join2Channel(user, newHeadingId)
  },

  setOrUpdateChatRoom: (key, value) => {
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

  switchChatRoom: (channelId) => {
    const updateChatRoom = useChatStore.getState().updateChatRoom
    updateChatRoom('headingId', channelId)
    const user = useAuthStore.getState().profile
    if (user) switchChannel(user, channelId)
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
    if (user) leaveChannel(user)
  }
}))

export default chatRoom
