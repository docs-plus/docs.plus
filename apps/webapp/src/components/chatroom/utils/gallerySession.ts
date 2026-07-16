import {
  type GalleryOpenOptions,
  type GallerySessionSnapshot,
  openGallerySession
} from '@components/chatroom/utils/galleryPlaylist'
import type { MessageMediaItem } from '@types'

export type GallerySessionState = GallerySessionSnapshot & { isOpen: boolean }

export const GALLERY_SESSION_CLOSED: GallerySessionState = {
  isOpen: false,
  items: [],
  index: 0,
  autoplayIndex: 0,
  caption: null,
  source: null,
  originMessage: null
}

/** Pure session snapshot — store owns clearing zoom/media/url handles around these calls. */
export function beginGallerySession(
  medias: MessageMediaItem[],
  at?: number | MessageMediaItem,
  options?: GalleryOpenOptions
): GallerySessionState | null {
  const session = openGallerySession(medias, at, options)
  if (!session) return null
  return { isOpen: true, ...session }
}

export function stepGallerySession(
  state: Pick<GallerySessionState, 'index' | 'items'>,
  delta: -1 | 1
): { index: number } | null {
  if (state.items.length <= 1) return null
  const next = state.index + delta
  if (next < 0 || next >= state.items.length) return null
  return { index: next }
}

/** True when the open chatroom left the gallery's origin channel. */
export function galleryChannelDiverged(
  galleryChannelId: string | undefined,
  activeChannelId: string | undefined
): boolean {
  return Boolean(galleryChannelId && activeChannelId && galleryChannelId !== activeChannelId)
}
