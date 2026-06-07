import { create } from 'zustand'

interface FocusedHeadingStore {
  focusedHeadingId: string | null
  isScrollLocked: boolean
  setFocusedHeadingId: (id: string | null) => void
  /** Sets heading ID and temporarily locks scroll spy updates (for programmatic scrolls) */
  setFocusedHeadingWithLock: (id: string | null, lockDuration?: number) => void
}

let scrollLockTimeout: ReturnType<typeof setTimeout> | null = null

export const useFocusedHeadingStore = create<FocusedHeadingStore>((set) => ({
  focusedHeadingId: null,
  isScrollLocked: false,
  setFocusedHeadingId: (id) => set({ focusedHeadingId: id }),
  setFocusedHeadingWithLock: (id, lockDuration = 500) => {
    if (scrollLockTimeout) clearTimeout(scrollLockTimeout)
    set({ focusedHeadingId: id, isScrollLocked: true })
    scrollLockTimeout = setTimeout(() => {
      set({ isScrollLocked: false })
      scrollLockTimeout = null
    }, lockDuration)
  }
}))
