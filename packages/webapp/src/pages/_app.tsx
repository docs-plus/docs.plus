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

      // Viewport height correction
      const customViewportCorrectionVariable = 'vh'
      const setViewportProperty = (doc: HTMLElement) => {
        let prevClientHeight: number | undefined
        const customVar = '--' + (customViewportCorrectionVariable || 'vh')

        function handleResize() {
          let clientHeight = doc.clientHeight
          // Use visualViewport if available to support virtual keyboards (iOS/Android)
          if (window.visualViewport) {
            clientHeight = window.visualViewport.height
          }

          if (clientHeight === prevClientHeight) return
          requestAnimationFrame(function updateViewportHeight() {
            doc.style.setProperty(customVar, clientHeight * 0.01 + 'px')
            prevClientHeight = clientHeight
          })
        }
        handleResize()
        return handleResize
      }

      const onResize = setViewportProperty(document.documentElement)
      window.addEventListener('resize', onResize)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onResize)
      }
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
