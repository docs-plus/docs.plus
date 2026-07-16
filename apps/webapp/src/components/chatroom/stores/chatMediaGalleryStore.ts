import type { GalleryOpenOptions } from '@components/chatroom/utils/galleryPlaylist'
import {
  beginGallerySession,
  GALLERY_SESSION_CLOSED,
  type GallerySessionState,
  stepGallerySession
} from '@components/chatroom/utils/gallerySession'
import type { MessageMediaItem } from '@types'
import { create } from 'zustand'

/** Active-slide handles — module-local to this store file so request* and register share one HMR instance. */
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

type BoundZoom = { key: string; controller: GalleryZoomController }
type BoundMedia = { key: string; controller: GalleryMediaController }

let zoom: BoundZoom | null = null
let media: BoundMedia | null = null

/** Sync URL for copy/open on the click gesture (async re-sign loses clipboard). */
let activeMediaUrl: string | null = null

export function registerGalleryZoomController(
  key: string,
  controller: GalleryZoomController | null
): void {
  if (!controller) {
    if (zoom?.key === key) zoom = null
    return
  }
  zoom = { key, controller }
}

export function registerGalleryMediaController(
  key: string,
  controller: GalleryMediaController | null
): void {
  if (!controller) {
    if (media?.key === key) media = null
    return
  }
  media = { key, controller }
}

export function publishGalleryActiveMediaUrl(url: string | null): void {
  activeMediaUrl = url
}

export function readGalleryActiveMediaUrl(): string | null {
  return activeMediaUrl
}

const resetTransientHandles = () => {
  zoom = null
  media = null
  activeMediaUrl = null
}

type ChatMediaGalleryState = GallerySessionState & {
  openGallery: (
    medias: MessageMediaItem[],
    at?: number | MessageMediaItem,
    options?: GalleryOpenOptions
  ) => void
  closeGallery: () => void
  step: (delta: -1 | 1) => void
  requestZoomIn: () => void
  requestZoomStepIn: () => void
  requestZoomOut: () => void
  requestZoomReset: () => void
  requestPan: (dx: number, dy: number) => void
  requestTogglePlayback: () => void
}

export const useChatMediaGalleryStore = create<ChatMediaGalleryState>((set, get) => ({
  ...GALLERY_SESSION_CLOSED,

  openGallery: (medias, at, options) => {
    const session = beginGallerySession(medias, at, options)
    if (!session) return
    resetTransientHandles()
    set(session)
  },

  closeGallery: () => {
    resetTransientHandles()
    set(GALLERY_SESSION_CLOSED)
  },

  requestZoomIn: () => zoom?.controller.zoomInAtCenter(),
  requestZoomStepIn: () => zoom?.controller.zoomStepInAtCenter(),
  requestZoomOut: () => zoom?.controller.zoomStepOutAtCenter(),
  requestZoomReset: () => zoom?.controller.reset(),
  requestPan: (dx, dy) => zoom?.controller.panBy(dx, dy),
  requestTogglePlayback: () => media?.controller.togglePlayback(),

  step: (delta) => {
    const next = stepGallerySession(get(), delta)
    if (!next) return
    // Controllers re-register from the newly active slide; clear so stale handles cannot fire.
    resetTransientHandles()
    set(next)
  }
}))

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  ;(
    window as Window & { __chatMediaGalleryStore?: typeof useChatMediaGalleryStore }
  ).__chatMediaGalleryStore = useChatMediaGalleryStore
}
