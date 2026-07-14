import {
  type GalleryMediaItem,
  type GalleryOpenOptions,
  type GallerySourceContext,
  openGallerySession
} from '@components/chatroom/utils/galleryPlaylist'
import type { MessageMediaItem, TMsgRow } from '@types'
import { create } from 'zustand'

/** Active-slide handles — module-local to this store file so request* and register share one instance. */
export type GalleryZoomController = {
  zoomInAtCenter: () => void
  zoomStepInAtCenter: () => void
  zoomStepOutAtCenter: () => void
  reset: () => void
  panBy: (dx: number, dy: number) => void
}

export type GalleryMediaController = {
  togglePlayback: () => void
}

let zoomController: GalleryZoomController | null = null
let mediaController: GalleryMediaController | null = null

export const registerGalleryZoomController = (controller: GalleryZoomController | null) => {
  zoomController = controller
}

export const registerGalleryMediaController = (controller: GalleryMediaController | null) => {
  mediaController = controller
}

const clearSlideControllers = () => {
  zoomController = null
  mediaController = null
}

type ChatMediaGalleryState = {
  isOpen: boolean
  items: GalleryMediaItem[]
  index: number
  /** Index at open — A/V autoplay only for this slide, not on arrow navigate. */
  autoplayIndex: number
  caption: string | null
  source: GallerySourceContext | null
  originMessage: TMsgRow | null
  activeResolvedUrl: string | null
  openGallery: (
    medias: MessageMediaItem[],
    at?: number | MessageMediaItem,
    options?: GalleryOpenOptions
  ) => void
  closeGallery: () => void
  setActiveResolvedUrl: (url: string | null) => void
  step: (delta: -1 | 1) => void
  /** Toolbar / keyboard → active image slide (no-op when none registered). */
  requestZoomIn: () => void
  requestZoomStepIn: () => void
  requestZoomOut: () => void
  requestZoomReset: () => void
  requestPan: (dx: number, dy: number) => void
  requestTogglePlayback: () => void
}

const closedState = {
  isOpen: false,
  items: [] as GalleryMediaItem[],
  index: 0,
  autoplayIndex: 0,
  caption: null as string | null,
  source: null as GallerySourceContext | null,
  originMessage: null as TMsgRow | null,
  activeResolvedUrl: null as string | null
}

export const useChatMediaGalleryStore = create<ChatMediaGalleryState>((set, get) => ({
  ...closedState,

  openGallery: (medias, at, options) => {
    const session = openGallerySession(medias, at, options)
    if (!session) return

    clearSlideControllers()
    set({
      isOpen: true,
      ...session,
      activeResolvedUrl: null
    })
  },

  closeGallery: () => {
    clearSlideControllers()
    set(closedState)
  },

  setActiveResolvedUrl: (url) => set({ activeResolvedUrl: url }),

  requestZoomIn: () => zoomController?.zoomInAtCenter(),
  requestZoomStepIn: () => zoomController?.zoomStepInAtCenter(),
  requestZoomOut: () => zoomController?.zoomStepOutAtCenter(),
  requestZoomReset: () => zoomController?.reset(),
  requestPan: (dx, dy) => zoomController?.panBy(dx, dy),
  requestTogglePlayback: () => mediaController?.togglePlayback(),

  step: (delta) => {
    const { index, items } = get()
    if (items.length <= 1) return
    const next = index + delta
    if (next < 0 || next >= items.length) return
    // Controllers re-register from the newly active slide; clear so stale handles cannot fire.
    clearSlideControllers()
    set({ index: next, activeResolvedUrl: null })
  }
}))

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  ;(
    window as Window & { __chatMediaGalleryStore?: typeof useChatMediaGalleryStore }
  ).__chatMediaGalleryStore = useChatMediaGalleryStore
}
