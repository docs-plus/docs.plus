import { sendPresenceBroadcast } from '@services/workspacePresenceSync'
import type { Editor } from '@tiptap/core'
import type { ChatPaneMode, Profile } from '@types'
import type { HeadingAncestor } from '@utils/headingSlugTrail'
import { immer } from 'zustand/middleware/immer'

import { useAuthStore } from '../authStore'
import { useStore } from '../useStore'

type TChatRoom = {
  headingPath: Pick<HeadingAncestor, 'id' | 'text'>[]
  headingId?: string
  /**
   * The channel row of `headingId` in this document (#402). Undefined while it resolves,
   * null when the heading has no row yet. Database reads and writes use this, never `headingId`.
   */
  channelId?: string | null
  documentId?: string
  /** Read only on mobile. Desktop sizes its docked panel from `panelHeight`. */
  paneMode: ChatPaneMode
  panelHeight: number
  fetchMsgsFromId?: string
  editorInstance?: Editor
  /** Only the composer of `headingId` takes it, and only if focus stayed on `focusOrigin`. */
  composerFocusRequest?: { headingId: string; focusOrigin: Element | null }
}

interface IChatroomStore {
  chatRoom: TChatRoom
  setChatRoom: (
    headingId: string,
    documentId: string,
    user: Profile | null,
    fetchMsgsFromId?: string
  ) => void
  destroyChatRoom: () => void
  setPaneMode: (mode: ChatPaneMode) => void
  setOrUpdateChatPanelHeight: (height: number) => void
  setOrUpdateChatRoom: <K extends keyof TChatRoom>(key: K, value: TChatRoom[K]) => void
  /** Ignored when another heading opened while the channel resolved. */
  setChatRoomChannel: (headingId: string, channelId: string | null) => void
  switchChatRoom: (headingId: string) => void
}

const chatRoom = immer<IChatroomStore>((set, get) => ({
  chatRoom: {
    headingId: undefined,
    documentId: undefined,
    headingPath: [],
    paneMode: 'closed',
    panelHeight: 410,
    fetchMsgsFromId: undefined,
    editorInstance: undefined
  },

  setChatRoom: (headingId, documentId, user, fetchMsgsFromId) => {
    set((state) => {
      if (state.chatRoom.headingId !== headingId) state.chatRoom.channelId = undefined
      state.chatRoom.headingId = headingId
      state.chatRoom.documentId = documentId
      state.chatRoom.headingPath = []
      state.chatRoom.fetchMsgsFromId = fetchMsgsFromId
    })

    if (user) {
      const broadcaster = useStore.getState().settings?.broadcaster
      sendPresenceBroadcast(broadcaster, user, headingId)
    }
  },

  // A plain object, not a recipe: immer's Draft type rejects a TipTap Editor.
  setOrUpdateChatRoom: (key, value) => {
    set({ chatRoom: { ...get().chatRoom, [key]: value } })
  },

  setChatRoomChannel: (headingId, channelId) => {
    set((state) => {
      if (state.chatRoom.headingId === headingId) state.chatRoom.channelId = channelId
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

  switchChatRoom: (headingId) => {
    set((state) => {
      if (state.chatRoom.headingId !== headingId) state.chatRoom.channelId = undefined
      state.chatRoom.headingId = headingId
    })

    const user = useAuthStore.getState().profile
    if (user) {
      const broadcaster = useStore.getState().settings?.broadcaster
      sendPresenceBroadcast(broadcaster, user, headingId)
    }
  },

  destroyChatRoom: () => {
    const { panelHeight } = get().chatRoom
    const broadcaster = useStore.getState().settings?.broadcaster

    set((s) => {
      s.chatRoom = {
        headingId: undefined,
        documentId: undefined,
        headingPath: [],
        // Unlike panelHeight, the mode does not survive: closing unmounts the
        // chat subtree, so there is no geometry left to remember.
        paneMode: 'closed',
        panelHeight,
        editorInstance: undefined
      }
    })

    const user = useAuthStore.getState().profile
    if (user) sendPresenceBroadcast(broadcaster, user, null)
  }
}))

export default chatRoom
