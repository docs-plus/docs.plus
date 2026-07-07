import {
  type GalleryMediaItem,
  type GalleryOpenOptions,
  type GallerySourceContext,
  openGallerySession
} from '@components/chatroom/utils/galleryPlaylist'
import type { MessageMediaItem, TMsgRow } from '@types'
import { create } from 'zustand'

type ChatMediaGalleryState = {
  isOpen: boolean
  items: GalleryMediaItem[]
  index: number
  openIndex: number
  caption: string | null
  source: GallerySourceContext | null
  originMessage: TMsgRow | null
  activeResolvedUrl: string | null
  zoomRequest: number
  zoomResetRequest: number
  openGallery: (
    medias: MessageMediaItem[],
    at?: number | MessageMediaItem,
    options?: GalleryOpenOptions
  ) => void
  closeGallery: () => void
  setActiveResolvedUrl: (url: string | null) => void
  step: (delta: -1 | 1) => void
  requestZoomIn: () => void
  requestZoomReset: () => void
}

const closedState = {
  isOpen: false,
  items: [] as GalleryMediaItem[],
  index: 0,
  openIndex: 0,
  caption: null as string | null,
  source: null as GallerySourceContext | null,
  originMessage: null as TMsgRow | null,
  activeResolvedUrl: null as string | null,
  zoomRequest: 0,
  zoomResetRequest: 0
}

export const useChatMediaGalleryStore = create<ChatMediaGalleryState>((set, get) => ({
  ...closedState,

  openGallery: (medias, at, options) => {
    const session = openGallerySession(medias, at, options)
    if (!session) return

    set({
      isOpen: true,
      ...session,
      activeResolvedUrl: null,
      zoomRequest: 0,
      zoomResetRequest: 0
    })
  },

  closeGallery: () => set(closedState),

  setActiveResolvedUrl: (url) => set({ activeResolvedUrl: url }),

  requestZoomIn: () => set((state) => ({ zoomRequest: state.zoomRequest + 1 })),

  requestZoomReset: () => set((state) => ({ zoomResetRequest: state.zoomResetRequest + 1 })),

  step: (delta) => {
    const { index, items } = get()
    if (items.length <= 1) return
    const next = index + delta
    if (next < 0 || next >= items.length) return
    set({ index: next, activeResolvedUrl: null })
  }
}))
