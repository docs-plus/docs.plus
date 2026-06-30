import '../styles/globals.scss'
import '../styles/shell.scss'
import '@config'

import { AppQueryClientRoot } from '@components/AppQueryClientRoot'
import GoogleAnalytics from '@components/GoogleAnalytics'
import { QueryClient } from '@tanstack/react-query'
import { installChunkLoadRecovery } from '@utils/chunkLoadRecovery'
import { getRoutePolicy } from '@utils/routePolicy'
import { MotionConfig } from 'motion/react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { type ComponentType, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'

const AppProviders = dynamic(() => import('@components/AppProviders'), { ssr: false })
const NotificationPromptCard = dynamic(() => import('@components/NotificationPromptCard'), {
  ssr: false
})
const PWAInstallPrompt = dynamic(
  () => import('@components/pwa').then((module) => module.PWAInstallPrompt),
  { ssr: false }
)

// Install before dynamic chunks load so a stale-asset failure after a deploy
// reloads the page once instead of leaving a broken shell.
if (typeof window !== 'undefined') installChunkLoadRecovery()

function loadDocumentStyles() {
  void import('../styles/document-styles.scss').then(
    () => import('../styles/editor-extensions.scss')
  )
}

function isDocumentAsPath(asPath: string): boolean {
  const path = asPath.split(/[?#]/)[0] || '/'
  if (path === '/' || path === '') return false
  if (path.startsWith('/auth/')) return false
  return true
}

const Header = () => {
  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

      <meta
        name="keywords"
        content="docs.plus, real-time, collaborative, open-source, communities, knowledge sharing, document editor"
      />
    </Head>
  )
}

interface AppPageProps {
  isMobile?: boolean
  isAuthServiceAvailable?: boolean
}

export default function MyApp({
  Component,
  pageProps
}: {
  Component: ComponentType<AppPageProps>
  pageProps: AppPageProps
}) {
  const router = useRouter()
  const [queryClient] = useState(() => new QueryClient())
  const isMobileInitial = pageProps.isMobile || false
  const isAuthServiceAvailable = pageProps.isAuthServiceAvailable
  const documentShell = getRoutePolicy(router.pathname).documentShell

  useEffect(() => {
    if (!documentShell) return
    loadDocumentStyles()
  }, [documentShell])

  useEffect(() => {
    const prefetchOnNavigate = (url: string) => {
      if (isDocumentAsPath(url)) loadDocumentStyles()
    }
    router.events.on('routeChangeStart', prefetchOnNavigate)
    return () => router.events.off('routeChangeStart', prefetchOnNavigate)
  }, [router.events])

  return (
    <div id="root">
      <MotionConfig reducedMotion="user">
        <Header />
        <GoogleAnalytics />
        <NotificationPromptCard />
        <PWAInstallPrompt />
        <AppProviders
          isMobileInitial={isMobileInitial}
          isAuthServiceAvailable={isAuthServiceAvailable}
        />
        <AppQueryClientRoot queryClient={queryClient}>
          <Component {...pageProps} />
        </AppQueryClientRoot>
        <Toaster />
      </MotionConfig>
    </div>
  )
}
