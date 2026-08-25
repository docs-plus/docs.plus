/**
 * Router-dependent hooks that can't run during SSG.
 */

import { flushPendingWrites, performMaintenanceCleanup } from '@db/messageComposerDB'
import { useBroadcastListener } from '@hooks/useBroadcastListener'
import { useCatchUserPresences } from '@hooks/useCatchUserPresences'
import { useHandleUserStatus } from '@hooks/useHandleUserStatus'
import { useInitialSteps } from '@hooks/useInitialSteps'
import { useOnAuthStateChange } from '@hooks/useOnAuthStateChange'
import useServiceWorker from '@hooks/useServiceWorker'
import { useVisualViewportCssSync } from '@hooks/useVisualViewportCssSync'
import { eventsHub } from '@services/eventsHub'
import { useStore } from '@stores'
import { getRoutePolicy } from '@utils/routePolicy'
import { useRouter } from 'next/router'
import { useEffect, useLayoutEffect } from 'react'

interface AppProvidersProps {
  isMobileInitial: boolean
  isAuthServiceAvailable?: boolean
}

export default function AppProviders({
  isMobileInitial,
  isAuthServiceAvailable
}: AppProvidersProps) {
  const router = useRouter()
  const policy = getRoutePolicy(router.pathname)
  const { documentShell } = policy

  useLayoutEffect(() => {
    const available = isAuthServiceAvailable ?? Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    useStore.getState().setWorkspaceSetting('isAuthServiceAvailable', available)
  }, [isAuthServiceAvailable])

  useVisualViewportCssSync({ mode: policy.viewportMode })

  useServiceWorker()
  useOnAuthStateChange()
  useCatchUserPresences(documentShell)
  useBroadcastListener(documentShell)
  useHandleUserStatus(documentShell)
  useInitialSteps(isMobileInitial, documentShell)

  useEffect(() => {
    if (!router.isReady || !documentShell) return
    const stop = eventsHub(router)

    performMaintenanceCleanup().catch(() => {
      // Silently fail - cleanup is best-effort
    })
    return stop
  }, [router, router.isReady, documentShell])

  // Mobile browsers often fire neither beforeunload nor unload. These two events are the
  // last reliable moment to write a debounced chat draft to IndexedDB.
  useEffect(() => {
    const flushDrafts = () => {
      try {
        flushPendingWrites()
      } catch {
        // Losing one draft is better than breaking the page-hide path.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDrafts()
    }

    window.addEventListener('pagehide', flushDrafts)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushDrafts)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
