import { prefersReducedMotion } from '@utils/motion'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  applyThemeToDom,
  type ResolvedTheme,
  resolveTheme,
  type ThemePreference
} from './themeConfig'

type ThemeWrite = {
  resolved: ResolvedTheme
  afterWrite: () => void
}

type ThemeFade = {
  transition: ViewTransition
  queued: ThemeWrite | null
}

let fade: ThemeFade | null = null

function writeTheme(write: ThemeWrite): void {
  applyThemeToDom(write.resolved)
  write.afterWrite()
}

function shouldAnimate(from: string | null, to: ResolvedTheme, motion: boolean): boolean {
  if (!motion || from === to) return false
  if (prefersReducedMotion()) return false
  if (typeof document.startViewTransition !== 'function') return false
  if (window.matchMedia('(forced-colors: active)').matches) return false
  if (from === 'docsplus-dark-hc' || to === 'docsplus-dark-hc') return false
  if (document.documentElement.classList.contains('m_mobile')) return false
  if (document.visibilityState === 'hidden') return false
  return true
}

function transitionThemeToDom(
  resolved: ResolvedTheme,
  afterWrite: () => void,
  motion: boolean
): void {
  const write: ThemeWrite = { resolved, afterWrite }

  if (typeof document === 'undefined') {
    writeTheme(write)
    return
  }

  if (fade) {
    fade.queued = write
    fade.transition.skipTransition()
    return
  }

  if (!shouldAnimate(document.documentElement.getAttribute('data-theme'), resolved, motion)) {
    writeTheme(write)
    return
  }

  try {
    const transition = document.startViewTransition(() => writeTheme(write))
    fade = { transition, queued: null }
    void transition.ready.catch(() => {})
    void transition.finished.finally(() => {
      const queued = fade?.queued
      fade = null
      if (queued) writeTheme(queued)
    })
  } catch {
    fade = null
    writeTheme(write)
  }
}

export interface ThemeStore {
  /** Persisted in localStorage under `docsplus-theme`. */
  preference: ThemePreference
  /** What is currently written to the DOM as `data-theme`. */
  resolvedTheme: ResolvedTheme

  setPreference: (preference: ThemePreference, opts?: { motion?: boolean }) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'light',
      resolvedTheme: 'docsplus',

      setPreference: (preference, opts) => {
        const resolved = resolveTheme(preference)
        transitionThemeToDom(
          resolved,
          () => set({ preference, resolvedTheme: resolved }),
          opts?.motion !== false
        )
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
