/**
 * Client-side App Providers
 * =========================
 * Contains router-dependent hooks that can't run during SSG.
 * This component is dynamically imported in _app.tsx.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useOnAuthStateChange } from '@hooks/useOnAuthStateChange'
import { useCatchUserPresences } from '@hooks/useCatchUserPresences'
import { useInitialSteps } from '@hooks/useInitialSteps'
import { useBroadcastListner } from '@hooks/useBroadcastListner'
import useServiceWorker from '@hooks/useServiceWorker'
import { useHandleUserStatus } from '@hooks/useHanelUserStatus'
import { eventsHub } from '@services/eventsHub'
import { performMaintenanceCleanup } from '@db/messageComposerDB'
import { useEditorPreferences, applyEditorPreferences } from '@stores'

interface AppProvidersProps {
  isMobileInitial: boolean
}

export default function AppProviders({ isMobileInitial }: AppProvidersProps) {
  const router = useRouter()
  const { preferences, hydrated } = useEditorPreferences()

  useServiceWorker()
  useOnAuthStateChange()
  useCatchUserPresences()
  useBroadcastListner()
  useHandleUserStatus()
  useInitialSteps(isMobileInitial)

  // Apply editor preferences on hydration and changes
  useEffect(() => {
    if (hydrated) applyEditorPreferences(preferences)
  }, [hydrated, preferences])

  useEffect(() => {
    if (!router.isReady) return
    eventsHub(router)

    // Run DB maintenance cleanup once per session
    performMaintenanceCleanup().catch(() => {
      // Silently fail - cleanup is best-effort
    })

    // iOS Safari keyboard viewport fix
    const doc = document.documentElement
    let lastHeight = window.visualViewport?.height ?? window.innerHeight
    let rafId: number | null = null

    const vv = window.visualViewport
    if (vv) {
      doc.style.setProperty('--visual-viewport-height', `${vv.height}px`)
      doc.style.setProperty('--vh', `${vv.height * 0.01}px`)
    }

    function handleViewportResize() {
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        const vv = window.visualViewport
        if (!vv) return

        const height = vv.height
        if (Math.abs(height - lastHeight) < 50) return

        lastHeight = height
        doc.style.setProperty('--visual-viewport-height', `${height}px`)
        doc.style.setProperty('--vh', `${height * 0.01}px`)
      })
    }

    let scrollResetTimeout: ReturnType<typeof setTimeout> | null = null

    function handleViewportScroll() {
      const vv = window.visualViewport
      if (!vv || vv.offsetTop === 0) return

      if (scrollResetTimeout) clearTimeout(scrollResetTimeout)

      scrollResetTimeout = setTimeout(() => {
        if (window.visualViewport && window.visualViewport.offsetTop > 0) {
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
