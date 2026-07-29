import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  applyThemeToDom,
  type ResolvedTheme,
  resolveTheme,
  type ThemePreference
} from './themeConfig'

export interface ThemeStore {
  /** Persisted in localStorage under `docsplus-theme`. */
  preference: ThemePreference
  /** What is currently written to the DOM as `data-theme`. */
  resolvedTheme: ResolvedTheme

  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'light',
      resolvedTheme: 'docsplus',

      setPreference: (preference) => {
        const resolved = resolveTheme(preference)
        applyThemeToDom(resolved)
        set({ preference, resolvedTheme: resolved })
      }
    }),
    {
      name: 'docsplus-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.preference)
          applyThemeToDom(resolved)
          state.resolvedTheme = resolved
        }
      }
    }
  )
)

// Track OS theme changes, but only while the preference is "system".
if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')

  mql.addEventListener('change', () => {
    const { preference } = useThemeStore.getState()
    if (preference !== 'system') return

    const resolved = resolveTheme('system')
    applyThemeToDom(resolved)
    useThemeStore.setState({ resolvedTheme: resolved })
  })
}
