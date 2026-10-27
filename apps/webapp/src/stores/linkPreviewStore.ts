import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LinkPreviewStore {
  showOnHover: boolean

  setShowOnHover: (value: boolean) => void
}

export const useLinkPreviewStore = create<LinkPreviewStore>()(
  persist(
    (set) => ({
      showOnHover: true,

      setShowOnHover: (value) => set({ showOnHover: value })
    }),
    { name: 'docsplus-link-previews' }
  )
)

if (typeof window !== 'undefined') {
  // The choice is per browser. Another tab's pick arrives through storage and rehydrates here.
  window.addEventListener('storage', (event) => {
    if (event.key === useLinkPreviewStore.persist.getOptions().name) {
      void useLinkPreviewStore.persist.rehydrate()
    }
  })
}
