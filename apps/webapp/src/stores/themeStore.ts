import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  applyThemeToDom,
  type ResolvedTheme,
  resolveTheme,
  type ThemePreference
} from './themeConfig'

export interface ThemeStore {
  /** User's preference (persisted in localStorage) */
  preference: ThemePreference
  /** The resolved theme currently applied to the DOM */
  resolvedTheme: ResolvedTheme

  setPreference: (preference: ThemePreference) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

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
          // On hydration, resolve and apply the persisted preference
          const resolved = resolveTheme(state.preference)
          applyThemeToDom(resolved)
          state.resolvedTheme = resolved
        }
      }
    }
  )
)

// ---------------------------------------------------------------------------
// Side-effect: listen for OS theme changes when preference is "system"
// ---------------------------------------------------------------------------

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
