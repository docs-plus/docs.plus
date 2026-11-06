import { create } from 'zustand'

interface FocusedHeadingStore {
  focusedHeadingId: string | null
  isScrollLocked: boolean
  setFocusedHeadingId: (id: string | null) => void
  /** Locks scroll spy while a programmatic scroll lands. */
  setFocusedHeadingWithLock: (id: string | null) => void
  releaseScrollLock: () => void
}

/** Upper bound only: a TOC navigate releases the lock once its heading lands. */
const SCROLL_LOCK_MAX_MS = 3000

let scrollLockTimeout: ReturnType<typeof setTimeout> | null = null

export const useFocusedHeadingStore = create<FocusedHeadingStore>((set) => ({
  focusedHeadingId: null,
  isScrollLocked: false,
  setFocusedHeadingId: (id) => set({ focusedHeadingId: id }),
  setFocusedHeadingWithLock: (id) => {
    if (scrollLockTimeout) clearTimeout(scrollLockTimeout)
    set({ focusedHeadingId: id, isScrollLocked: true })
    scrollLockTimeout = setTimeout(() => {
      set({ isScrollLocked: false })
      scrollLockTimeout = null
    }, SCROLL_LOCK_MAX_MS)
  },
  releaseScrollLock: () => {
    if (scrollLockTimeout) clearTimeout(scrollLockTimeout)
    scrollLockTimeout = null
    set({ isScrollLocked: false })
  }
}))
