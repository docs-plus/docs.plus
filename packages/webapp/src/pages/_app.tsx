import Head from 'next/head'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnAuthStateChange } from '@hooks/useOnAuthStateChange'
import { useCatchUserPresences } from '@hooks/useCatchUserPresences'
import { useInitialSteps } from '@hooks/useInitialSteps'
import { useBroadcastListner } from '@hooks/useBroadcastListner'
import useServiceWorker from '@hooks/useServiceWorker'
import { useHandleUserStatus } from '@hooks/useHanelUserStatus'
import { eventsHub } from '@services/eventsHub'
import GoogleAnalytics from '@components/GoogleAnalytics'
import NotificationPromptCard from '@components/NotificationPromptCard'
import { performMaintenanceCleanup } from '@db/messageComposerDB'
import { useEditorPreferences, applyEditorPreferences } from '@stores'

import '../styles/globals.scss'
import '../styles/styles.scss'
import { useRouter } from 'next/router'
import '@config'

// import { initializeApm } from '@utils/elasticApm'

// Create a client
const queryClient = new QueryClient()

const Header = () => {
  return (
    <Head>
      {/* Viewport - must be in _app for proper hydration */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      />

      {/* IE compatibility */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

      {/* SEO keywords */}
      <meta
        name="keywords"
        content="docs.plus, real-time, collaborative, open-source, communities, knowledge sharing, document editor"
      />
    </Head>
  )
}

export default function MyApp({ Component, pageProps }: any) {
  const isMobileInitial = pageProps.isMobile || false
  const { preferences, hydrated } = useEditorPreferences()

  const router = useRouter()

  useServiceWorker()
  useOnAuthStateChange()
  useCatchUserPresences()
  // pinnedMessage, typingIndicator broadcaster
  useBroadcastListner()
  // service worker side
  useHandleUserStatus()
  useInitialSteps(isMobileInitial)

  // Apply editor preferences on hydration and changes
  useEffect(() => {
    if (hydrated) applyEditorPreferences(preferences)
  }, [hydrated, preferences])

  useEffect(() => {
    eventsHub(router)
    // initializeApm()

    // Run DB maintenance cleanup once per session (client-side only)
    if (typeof window !== 'undefined') {
      performMaintenanceCleanup().catch(() => {
        // Silently fail - cleanup is best-effort
      })

      // iOS Safari keyboard viewport fix
      // Two key behaviors to handle:
      // 1. Height changes when keyboard opens/closes
      // 2. iOS auto-scrolls when focusing elements in bottom half of screen
      const doc = document.documentElement
      let lastHeight = window.visualViewport?.height ?? window.innerHeight
      let rafId: number | null = null

      // Set initial height
      const vv = window.visualViewport
      if (vv) {
        doc.style.setProperty('--visual-viewport-height', `${vv.height}px`)
        doc.style.setProperty('--vh', `${vv.height * 0.01}px`)
      }

      // Update height immediately using rAF for smooth rendering
      function handleViewportResize() {
        if (rafId) cancelAnimationFrame(rafId)

        rafId = requestAnimationFrame(() => {
          const vv = window.visualViewport
          if (!vv) return

          const height = vv.height

          // Skip micro-updates (less than 50px change might be just toolbar hiding)
          if (Math.abs(height - lastHeight) < 50) return

          lastHeight = height
          doc.style.setProperty('--visual-viewport-height', `${height}px`)
          doc.style.setProperty('--vh', `${height * 0.01}px`)
        })
      }

      // CRITICAL: When iOS auto-scrolls to show focused element, reset scroll
      // This prevents the "off-screen" issue when tapping bottom half
      let scrollResetTimeout: ReturnType<typeof setTimeout> | null = null

      function handleViewportScroll() {
        const vv = window.visualViewport
        if (!vv || vv.offsetTop === 0) return

        // Clear any pending reset
        if (scrollResetTimeout) clearTimeout(scrollResetTimeout)

        // Debounce the scroll reset to let iOS finish its animation
        scrollResetTimeout = setTimeout(() => {
          // Double-check offsetTop is still non-zero
          if (window.visualViewport && window.visualViewport.offsetTop > 0) {
            // Reset window scroll - our fixed container will realign
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
    }
  }, [])

  return (
    <div id="root">
      <Header />
      <GoogleAnalytics />
      <NotificationPromptCard />
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
      <Toaster />
    </div>
  )
}
