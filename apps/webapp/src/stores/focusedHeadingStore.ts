import { create } from 'zustand'

interface FocusedHeadingStore {
  focusedHeadingId: string | null
  isScrollLocked: boolean
  setFocusedHeadingId: (id: string | null) => void
  /** Locks scroll spy while a programmatic scroll lands. */
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
