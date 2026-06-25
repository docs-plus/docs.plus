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
      scheduleSync()
      if (!isHomeMobileLayout()) return
      requestAnimationFrame(() => {
        const block = document.getElementById('home-action-block')
        if (block) {
          block.scrollIntoView({ block: 'center', behavior: 'auto' })
        } else {
          t.scrollIntoView({ block: 'center', behavior: 'auto' })
        }
      })
    }

    scheduleSync()

    const vv = window.visualViewport
    let scrollResetTimeout: ReturnType<typeof setTimeout> | null = null

    const handleViewportScroll = () => {
      scheduleSync()
      if (mode !== 'document') return

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
