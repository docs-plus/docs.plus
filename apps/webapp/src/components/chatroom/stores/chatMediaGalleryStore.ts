import type { MessageMediaItem } from '@types'
import { create } from 'zustand'

type ChatMediaGalleryState = {
  isOpen: boolean
  images: MessageMediaItem[]
  video: MessageMediaItem | null
  index: number
  openGallery: (images: MessageMediaItem[], startIndex?: number) => void
  openVideo: (media: MessageMediaItem) => void
  closeGallery: () => void
  setIndex: (index: number) => void
  step: (delta: -1 | 1) => void
}

export const useChatMediaGalleryStore = create<ChatMediaGalleryState>((set, get) => ({
  isOpen: false,
  images: [],
  video: null,
  index: 0,

  openGallery: (images, startIndex = 0) => {
    if (images.length === 0) return
    const clamped = Math.min(Math.max(startIndex, 0), images.length - 1)
    set({ isOpen: true, images, video: null, index: clamped })
  },

  openVideo: (media) => {
    if (media.type !== 'video') return
    set({ isOpen: true, video: media, images: [], index: 0 })
  },

  closeGallery: () => set({ isOpen: false, images: [], video: null, index: 0 }),

  setIndex: (index) => {
    const { images } = get()
    if (images.length === 0) return
    set({ index: Math.min(Math.max(index, 0), images.length - 1) })
  },

  step: (delta) => {
    const { index, images } = get()
    if (images.length <= 1) return
    const next = index + delta
    if (next < 0 || next >= images.length) return
    set({ index: next })
  }
}))
