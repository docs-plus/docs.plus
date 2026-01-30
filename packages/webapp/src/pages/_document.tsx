import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" data-theme="docsyLight">
      <Head>
        {/* Character encoding - must be first */}
        <meta charSet="utf-8" />

        {/* PWA Manifest - critical for installability */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari PWA - required for standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Docs.plus" />

        {/* Android Chrome PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Docs.plus" />

        {/* Theme color - browser chrome, status bar */}
        <meta name="theme-color" content="#2778ff" />
        <meta name="msapplication-TileColor" content="#2778ff" />

        {/* Favicons */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="shortcut icon" href="/icons/favicon.ico" />

        {/* Apple Touch Icons - for iOS home screen */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon.png" />

        {/* Safari Mask Icon */}
        <link rel="mask-icon" href="/icons/maskable_icon.png" color="#2778ff" />

        {/* Android Chrome shortcut icon */}
        <link rel="shortcut icon" sizes="192x192" href="/icons/android-chrome-192x192.png" />

        {/* Disable auto-detection */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="address=no" />
        <meta name="format-detection" content="email=no" />

        {/* SEO - basic */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />

        {/* Open Graph - basic */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Docs.plus" />
        <meta property="og:image" content="/icons/android-chrome-512x512.png" />
        <meta property="og:image:alt" content="Docs.plus" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/icons/android-chrome-512x512.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
