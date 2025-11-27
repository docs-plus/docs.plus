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
import { performMaintenanceCleanup } from '@db/messageComposerDB'

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

  const router = useRouter()

  useServiceWorker()
  useOnAuthStateChange()
  useCatchUserPresences()
  // pinnedMessage, typingIndicator broadcaster
  useBroadcastListner()
  // service worker side
  useHandleUserStatus()
  useInitialSteps(isMobileInitial)
  useEffect(() => {
    eventsHub(router)
    // initializeApm()

    // Run DB maintenance cleanup once per session (client-side only)
    if (typeof window !== 'undefined') {
      performMaintenanceCleanup().catch(() => {
        // Silently fail - cleanup is best-effort
      })

      // Viewport height correction for iOS Safari keyboard handling
      let prevHeight: number | undefined
      let prevOffsetTop: number | undefined
      const doc = document.documentElement

      function updateViewportHeight() {
        const vv = window.visualViewport
        // Get visual viewport height (excludes keyboard on iOS/Android)
        const height = vv?.height ?? window.innerHeight
        // On iOS, visual viewport can scroll when keyboard opens
        const offsetTop = vv?.offsetTop ?? 0

        if (height === prevHeight && offsetTop === prevOffsetTop) return
        prevHeight = height
        prevOffsetTop = offsetTop

        requestAnimationFrame(() => {
          // --visual-viewport-height: actual pixel value for mobile layouts
          doc.style.setProperty('--visual-viewport-height', `${height}px`)
          // --visual-viewport-offset-top: how much visual viewport has scrolled
          doc.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`)
          // --vh: 1% of viewport for calc() usage (legacy)
          doc.style.setProperty('--vh', `${height * 0.01}px`)
        })
      }

      // Initial set
      updateViewportHeight()

      // Listen for changes
      window.addEventListener('resize', updateViewportHeight)
      window.visualViewport?.addEventListener('resize', updateViewportHeight)
      window.visualViewport?.addEventListener('scroll', updateViewportHeight)
    }
  }, [])

  return (
    <div id="root">
      <Header />
      <GoogleAnalytics />
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
      <Toaster />
    </div>
  )
}
