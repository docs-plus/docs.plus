/**
 * Client-side App Providers
 * =========================
 * Contains router-dependent hooks that can't run during SSG.
 * This component is dynamically imported in _app.tsx.
 */

import { performMaintenanceCleanup } from '@db/messageComposerDB'
import { useBroadcastListener } from '@hooks/useBroadcastListener'
import { useCatchUserPresences } from '@hooks/useCatchUserPresences'
import { useHandleUserStatus } from '@hooks/useHandleUserStatus'
import { useInitialSteps } from '@hooks/useInitialSteps'
import { useOnAuthStateChange } from '@hooks/useOnAuthStateChange'
import useServiceWorker from '@hooks/useServiceWorker'
import { eventsHub } from '@services/eventsHub'
import { resolveTheme, useThemeStore } from '@stores'
import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

interface AppProvidersProps {
  isMobileInitial: boolean
}

export default function AppProviders({ isMobileInitial }: AppProvidersProps) {
  const router = useRouter()
  const { preference: themePreference, hydrated: themeHydrated } = useThemeStore()

  useServiceWorker()
  useOnAuthStateChange()
  useCatchUserPresences()
  useBroadcastListener()
  useHandleUserStatus()
  useInitialSteps(isMobileInitial)

  // Apply theme on hydration (covers page reload / first visit)
  useEffect(() => {
    if (!themeHydrated) return
    const resolved = resolveTheme(themePreference)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [themeHydrated, themePreference])

  useEffect(() => {
    if (!router.isReady) return
    eventsHub(router)

    // Run DB maintenance cleanup once per session
    performMaintenanceCleanup().catch(() => {
      // Silently fail - cleanup is best-effort
    })

    // iOS Safari keyboard viewport fix — always mirror visualViewport.height (no magnitude
    // filter) so small post-animation resize steps are not dropped.
    const doc = document.documentElement
    let rafId: number | null = null

    syncVisualViewportToCssVars(doc)

    function scheduleVisualViewportSync() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        syncVisualViewportToCssVars(doc)
        rafId = null
      })
    }

    function handleViewportResize() {
      scheduleVisualViewportSync()
    }

    let scrollResetTimeout: ReturnType<typeof setTimeout> | null = null

    function handleViewportScroll() {
      scheduleVisualViewportSync()

      const vv = window.visualViewport
      if (!vv || vv.offsetTop === 0) return

      if (scrollResetTimeout) clearTimeout(scrollResetTimeout)

      scrollResetTimeout = setTimeout(() => {
        const vv = window.visualViewport
        if (!vv || vv.offsetTop <= 0) return
        // Including mobile pad: a non-zero layout scrollY (often == offsetTop) breaks fixed
        // shell + ProseMirror getBoundingClientRect (zeros / wrong caret) after keyboard cycles.
        if (window.scrollY > 0) {
          window.scrollTo(0, 0)
        }
      }, 100)
    }

    window.visualViewport?.addEventListener('resize', handleViewportResize)
    window.visualViewport?.addEventListener('scroll', handleViewportScroll)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (scrollResetTimeout) clearTimeout(scrollResetTimeout)
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
      window.visualViewport?.removeEventListener('scroll', handleViewportScroll)
    }
  }, [router.isReady])

  return null // This is a side-effect-only component
}
