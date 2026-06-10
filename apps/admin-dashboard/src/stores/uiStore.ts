import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: 'docsplus' | 'docsplus-dark'
  toggleTheme: () => void
  setTheme: (theme: 'docsplus' | 'docsplus-dark') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'docsplus',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'docsplus' ? 'docsplus-dark' : 'docsplus'
        })),
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'admin-ui-storage',
      partialize: (state) => ({ theme: state.theme })
    }
  )
)
