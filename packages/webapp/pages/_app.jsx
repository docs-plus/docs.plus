import Head from 'next/head'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import  {useAuthStore, supabaseClient} from '../utils/supabase'
import '../styles/styles.scss'
import '../styles/globals.scss'

const RelpadPrompt = dynamic(() => import(`../components/ReloadPrompt`), {
  ssr: false
})

import { EditorStateProvider } from '../context/EditorContext'
import { useEffect } from 'react'

// Create a client
const queryClient = new QueryClient()

const Header = () => {
  return (
    <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      <meta
        name="viewport"
        content="minimum-scale=1, initial-scale=1, height=device-height, maximum-scale=1.0, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover"
      />
      {/* Chrome, Firefox OS and Opera  */}
      <meta name="theme-color" content="#3367D6" />
      <link rel="shortcut icon" href="/icons/favicon.ico" />
      <link rel="icon" type="image/png" href="/icons/maskable_icon_x512.png" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      <meta property="og:image" content="/icons/logo.svg" />
      <meta property="og:image:alt" content="docs.plus" />
      <link rel="mask-icon" href="/icons/maskable_icon.png" color="#FFFFFF" />

      {/* Sets whether a web application runs in full-screen mode. See: https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html#//apple_ref/doc/uid/TP40008193-SW3 */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      {/* Web clip icon for Android homescreen shortcuts. Available since Chrome 31+ for Android.See: https://developers.google.com/chrome/mobile/docs/installtohomescreen */}
      <link rel="shortcut icon" sizes="192x192" href="/icons/android-chrome-192x192.png" />

      <link id="apple-touch-icon" rel="apple-touch-icon" href="/icons/android-chrome-512x512.png" />

      {/*
          Disables automatic detection of possible phone numbers in a webpage in Safari on iOS.
          See: https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html#//apple_ref/doc/uid/TP40008193-SW5
          See: https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html#//apple_ref/html/const/format-detection
        */}
      <meta name="format-detection" content="telephone=no" />
      <meta name="format-detection" content="address=no" />
      <meta
        name="keywords"
        content="docs.plus, real-time, collaborative, open-source, communities, knowledge sharing, Microsoft Word alternative"
      />
      <link rel="manifest" href="/manifest.json" />

      <meta name="application-name" content="docs.plus" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="docs.plus" />
    </Head>
  )
}

export default function MyApp({ Component, pageProps, initialSession }) {

  useEffect(() => {
    // Listen to Supabase authentication changes
    supabaseClient?.auth?.onAuthStateChange((event, session) => {
      session && useAuthStore.getState().setUser(session?.user || null)
    })
  }, [])

  const isMobileInitial = pageProps.isMobile || false

  // Create a new supabase browser client on every first render.
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div id="root">
        <Header />
        <QueryClientProvider client={queryClient}>
          <EditorStateProvider isMobileInitial={isMobileInitial}>
              <Component {...pageProps} />
          </EditorStateProvider>
        </QueryClientProvider>
        <RelpadPrompt />
        <Toaster />
      </div>
    )
  } else {
    return (
      <div id="root">
        <Header />
        <QueryClientProvider client={queryClient}>
          <EditorStateProvider isMobileInitial={isMobileInitial}>
            <Component {...pageProps} />
          </EditorStateProvider>
        </QueryClientProvider>
        <RelpadPrompt />
        <Toaster />
      </div>
    )
  }
}
