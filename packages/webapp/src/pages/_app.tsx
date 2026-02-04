import '../styles/globals.scss'
import '../styles/styles.scss'
import '@config'

import GoogleAnalytics from '@components/GoogleAnalytics'
import NotificationPromptCard from '@components/NotificationPromptCard'
import { IOSInstallPrompt, PWAInstallPrompt } from '@components/pwa'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { Toaster } from 'react-hot-toast'

// Dynamically import router-dependent hooks (client-side only)
// This prevents SSG errors on static pages like 404/500
const AppProviders = dynamic(() => import('@components/AppProviders'), { ssr: false })

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

  return (
    <div id="root">
      <Header />
      <GoogleAnalytics />
      <NotificationPromptCard />
      <IOSInstallPrompt />
      <PWAInstallPrompt />
      <AppProviders isMobileInitial={isMobileInitial} />
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
      <Toaster />
    </div>
  )
}
