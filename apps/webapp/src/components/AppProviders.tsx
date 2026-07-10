/**
 * Client-side App Providers
 * =========================
 * Router-dependent hooks that can't run during SSG.
 */

import { performMaintenanceCleanup } from '@db/messageComposerDB'
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
  useOnAuthStateChange({ deferAnonymousAuth: policy.deferAnonymousAuth })
  useCatchUserPresences(documentShell)
  useBroadcastListener(documentShell)
  useHandleUserStatus(documentShell)
  useInitialSteps(isMobileInitial, documentShell)

  useEffect(() => {
    if (!router.isReady || !documentShell) return
    eventsHub(router)

    performMaintenanceCleanup().catch(() => {
      // Silently fail - cleanup is best-effort
    })
  }, [router, router.isReady, documentShell])

  return null
}
