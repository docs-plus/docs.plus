import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import authStore, { selectIsSignedIn } from './authStore'

export interface LinkPreviewStore {
  showOnHover: boolean
  pasteTitles: boolean
  padPasteTitles: boolean

  setShowOnHover: (value: boolean) => void
  setPasteTitles: (value: boolean) => void
  setPadPasteTitles: (value: boolean) => void
}

export const useLinkPreviewStore = create<LinkPreviewStore>()(
  persist(
    (set) => ({
      showOnHover: true,
      pasteTitles: true,
      padPasteTitles: true,

      setShowOnHover: (value) => set({ showOnHover: value }),
      setPasteTitles: (value) => set({ pasteTitles: value }),
      setPadPasteTitles: (value) => set({ padPasteTitles: value })
    }),
    { name: 'docsplus-link-previews' }
  )
)

/** Settings is signed-in only, so a signed-out user keeps the default (on), even after an "off". */
export const linkPreviewOn = (setting: 'showOnHover' | 'pasteTitles' | 'padPasteTitles'): boolean =>
  !selectIsSignedIn(authStore.getState()) || useLinkPreviewStore.getState()[setting]

if (typeof window !== 'undefined') {
  // The choice is per browser. Another tab's pick arrives through storage and rehydrates here.
  window.addEventListener('storage', (event) => {
    if (event.key === useLinkPreviewStore.persist.getOptions().name) {
      void useLinkPreviewStore.persist.rehydrate()
    }
  })
}
