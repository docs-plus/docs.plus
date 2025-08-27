import { immer } from 'zustand/middleware/immer'
import { Database, Profile } from '@types'
import { useAuthStore, useStore } from '@stores'

type TChatRoom = {
  headingPath: Array<any>
  headingId?: string
  documentId?: string
  open: boolean
  pannelHeight: number
  userPickingEmoji?: any
  replyMessageMemory?: any
  editeMessageMemory?: any
  fetchMsgsFromId?: string
  editorInstance?: any
  editorRef?: any
  isReadyToDisplayMessages?: boolean
  disableScroll?: boolean
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
  toggleChatRoom: () => void
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
  const broadcaster = useStore.getState().settings?.broadcaster
  try {
    broadcaster?.send({
      type: 'broadcast',
      event: 'presence',
      payload: { ...user, channelId }
    })
  } catch (error) {
    console.error('Failed to join channel:', error)
  }
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

const chatRoom = immer<IChatroomStore>((set, get) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    open: false,
    pannelHeight: 410,
    userPickingEmoji: undefined,
    replyMessageMemory: undefined,
    editeMessageMemory: undefined,
    commentMessageMemory: undefined,
    fetchMsgsFromId: undefined,
    editorInstance: undefined,
    editorRef: undefined,
    isReadyToDisplayMessages: false,
    disableScroll: false
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
    set((state) => {
      state.chatRoom.headingId = channelId
    })

    const user = useAuthStore.getState().profile
    if (user) switchChannel(user, channelId)
  },

  toggleChatRoom: () => {
    set((state) => {
      state.chatRoom.open = !state.chatRoom.open
    })
  },

  destroyChatRoom: () => {
    set((state) => {
      state.chatRoom = {
        headingId: undefined,
        documentId: undefined,
        headingPath: [],
        open: false,
        pannelHeight: state.chatRoom.pannelHeight,
        editorInstance: undefined,
        editorRef: undefined
      }
    })
    const user = useAuthStore.getState().profile
    if (user) leaveChannel(user)
  }
}))

export default chatRoom
