import { HOME_SLUG_INPUT_ID, isHomeMobileLayout } from '@components/pages/home/homeMobileLayout'
import type { VisualViewportSyncMode } from '@utils/routePolicy'
import { resetVisualViewportCssVars, syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { useEffect } from 'react'

const LANDING_FOCUS_SELECTOR = `#${HOME_SLUG_INPUT_ID}`

export interface UseVisualViewportCssSyncOptions {
  mode: VisualViewportSyncMode
  focusScrollSelector?: string
}

export function useVisualViewportCssSync({
  mode,
  focusScrollSelector = LANDING_FOCUS_SELECTOR
}: UseVisualViewportCssSyncOptions): void {
  useEffect(() => {
    const doc = document.documentElement

    if (mode === 'off') {
      resetVisualViewportCssVars(doc)
      return
    }

    let rafId: number | null = null

    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (mode === 'landing' && !isHomeMobileLayout()) {
          resetVisualViewportCssVars(doc)
        } else {
          syncVisualViewportToCssVars(doc)
        }
        rafId = null
      })
    }

    const onLandingFocusIn = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof Element) || !t.matches(focusScrollSelector)) return
      // The shell is pinned to the visual viewport (see HomePage); only refresh the CSS vars.
      // No scrollIntoView — centering fought the pinned layout and drifted the header off-screen.
      scheduleSync()
    }

    scheduleSync()

    const vv = window.visualViewport
    let scrollResetTimeout: ReturnType<typeof setTimeout> | null = null

    const handleViewportScroll = () => {
      scheduleSync()
      // Reset iOS's native layout-viewport scroll so the fixed shell stays glued to the visual
      // viewport — document pad always, landing only while the mobile shell is pinned.
      const pinnedShell = mode === 'document' || (mode === 'landing' && isHomeMobileLayout())
      if (!pinnedShell) return

      const viewport = window.visualViewport
      if (!viewport || viewport.offsetTop === 0) return

      if (scrollResetTimeout) clearTimeout(scrollResetTimeout)

      scrollResetTimeout = setTimeout(() => {
        const latest = window.visualViewport
        if (!latest || latest.offsetTop <= 0) return
        if (window.scrollY > 0) {
          window.scrollTo(0, 0)
        }
      }, 100)
    }

    vv?.addEventListener('resize', scheduleSync)
    vv?.addEventListener('scroll', handleViewportScroll)
    if (mode !== 'document') {
      document.addEventListener('focusin', onLandingFocusIn, true)
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (scrollResetTimeout) clearTimeout(scrollResetTimeout)
      vv?.removeEventListener('resize', scheduleSync)
      vv?.removeEventListener('scroll', handleViewportScroll)
      if (mode !== 'document') {
        document.removeEventListener('focusin', onLandingFocusIn, true)
      }
      resetVisualViewportCssVars(doc)
    }
  }, [mode, focusScrollSelector])
}
