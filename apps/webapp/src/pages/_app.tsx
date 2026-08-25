import '../styles/globals.scss'
import '../styles/shell.scss'
import '@config'

import { AppQueryClientRoot } from '@components/AppQueryClientRoot'
import BottomSheet from '@components/BottomSheet'
import GoogleAnalytics from '@components/GoogleAnalytics'
import {
  HOME_OG_IMAGE,
  HOME_OG_IMAGE_HEIGHT,
  HOME_OG_IMAGE_WIDTH,
  HOME_SITE_URL
} from '@components/pages/home/homeMetadata'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { trackEvent } from '@utils/analytics'
import { installChunkLoadRecovery } from '@utils/chunkLoadRecovery'
import { captureUnknown } from '@utils/observability'
import { getRoutePolicy, isDocumentAsPath } from '@utils/routePolicy'
import { MotionConfig } from 'motion/react'
import type { NextWebVitalsMetric } from 'next/app'
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

const DOCUMENT_OG_DESCRIPTION =
  'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge efficiently.'

interface DocumentHeadMetadata {
  title?: string
  description?: string
  slug?: string
  isPrivate?: boolean
}

// The document shell is ssr:false, so a <Head> inside the page never reaches a social
// crawler. These tags render from _app, outside that boundary, so the server response
// carries them. HeadSeo still owns the client-side title on SPA navigation.
const DocumentHead = ({ docMetadata }: { docMetadata: DocumentHeadMetadata }) => {
  const title = docMetadata.title || 'docs.plus'
  const description = docMetadata.description || DOCUMENT_OG_DESCRIPTION
  const url = docMetadata.slug ? `${HOME_SITE_URL}/${docMetadata.slug}` : HOME_SITE_URL

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex, nofollow" />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={HOME_OG_IMAGE} />
      <meta property="og:image:width" content={HOME_OG_IMAGE_WIDTH} />
      <meta property="og:image:height" content={HOME_OG_IMAGE_HEIGHT} />

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:image" content={HOME_OG_IMAGE} />
    </Head>
  )
}

// Google's web-vitals → GA4 shape: CLS is unitless (x1000), the rest are ms.
// Custom Next.js metrics are skipped — their hyphenated names are GA4-invalid.
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label !== 'web-vital') return
  trackEvent(metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    metric_id: metric.id,
    metric_rating: (metric as { rating?: string }).rating,
    non_interaction: true
  })
}

interface AppPageProps {
  isMobile?: boolean
  isAuthServiceAvailable?: boolean
  docMetadata?: DocumentHeadMetadata | null
  gateVariant?: string | null
}

export default function MyApp({
  Component,
  pageProps
}: {
  Component: ComponentType<AppPageProps>
  pageProps: AppPageProps
}) {
  const router = useRouter()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => captureUnknown(error, { tags: { surface: 'react-query' } })
        }),
        mutationCache: new MutationCache({
          onError: (error) => captureUnknown(error, { tags: { surface: 'react-query' } })
        })
      })
  )
  const isMobileInitial = pageProps.isMobile || false
  const isAuthServiceAvailable = pageProps.isAuthServiceAvailable
  const documentShell = getRoutePolicy(router.pathname).documentShell
  // A blocked viewer gets `docMetadata: null`, and a private doc resolves only for its
  // owner — neither may put a title or description in the server response.
  const documentHeadMetadata =
    !pageProps.gateVariant && pageProps.docMetadata && !pageProps.docMetadata.isPrivate
      ? pageProps.docMetadata
      : null

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
        {documentHeadMetadata && <DocumentHead docMetadata={documentHeadMetadata} />}
        <GoogleAnalytics />
        <NotificationPromptCard />
        <PWAInstallPrompt />
        <AppProviders
          isMobileInitial={isMobileInitial}
          isAuthServiceAvailable={isAuthServiceAvailable}
        />
        {/* BottomSheet hosts LinkEditorSheet → useQuery. Outside this provider
            a phone link-edit throws and Next paints the client crash page. */}
        <AppQueryClientRoot queryClient={queryClient}>
          <Component {...pageProps} />
          <Toaster />
          <BottomSheet />
        </AppQueryClientRoot>
      </MotionConfig>
    </div>
  )
}
