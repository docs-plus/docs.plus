import { StateCreator } from 'zustand'
import { create } from 'zustand'
import { persist, PersistOptions } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** User preference — what they chose in Settings → Appearance */
export type ThemePreference = 'light' | 'dark' | 'dark-hc' | 'system'

/** Resolved DaisyUI theme name applied to `data-theme` */
export type ResolvedTheme = 'docsplus' | 'docsplus-dark' | 'docsplus-dark-hc'

export interface ThemeStore {
  /** User's preference (persisted in localStorage) */
  preference: ThemePreference
  /** The resolved theme currently applied to the DOM */
  resolvedTheme: ResolvedTheme
  /** Whether the store has been hydrated from localStorage */
  hydrated: boolean

  setPreference: (preference: ThemePreference) => void
  setHydrated: (state: boolean) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a preference + OS setting into a concrete theme name. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark') return 'docsplus-dark'
  if (preference === 'dark-hc') return 'docsplus-dark-hc'
  if (preference === 'light') return 'docsplus'

  // "system" — check OS preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'docsplus-dark'
  }
  return 'docsplus'
}

/** Map resolved theme to emoji-mart theme (Picker). Single place for this contract. */
export function getEmojiMartTheme(resolved: ResolvedTheme): 'light' | 'dark' {
  return resolved === 'docsplus' ? 'light' : 'dark'
}

/** Apply theme to the DOM (instant swap — see Theme_Light_Dark.md §6.6) */
function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ThemeStorePersist = (
  config: StateCreator<ThemeStore>,
  options: PersistOptions<ThemeStore>
) => StateCreator<ThemeStore>

export const useThemeStore = create<ThemeStore>(
  (persist as ThemeStorePersist)(
    (set) => ({
      preference: 'light',
      resolvedTheme: 'docsplus',
      hydrated: false,

      setHydrated: (state) => set({ hydrated: state }),

      setPreference: (preference) => {
        const resolved = resolveTheme(preference)
        applyTheme(resolved)
        set({ preference, resolvedTheme: resolved })
      }
    }),
    {
      name: 'docsplus-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // On hydration, resolve and apply the persisted preference
          const resolved = resolveTheme(state.preference)
          applyTheme(resolved)
          state.resolvedTheme = resolved
          state.setHydrated(true)
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
    applyTheme(resolved)
    useThemeStore.setState({ resolvedTheme: resolved })
  })
}
