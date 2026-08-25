import { Head, Html, Main, NextScript } from 'next/document'

import { PREFERENCE_TO_THEME } from '../stores/themeConfig'

// Runs before hydration to prevent FOUC: read the persisted preference and apply the resolved
// `data-theme`. The map is interpolated from themeConfig (SSR), so this vanilla-JS copy never
// drifts from the store's `resolveTheme`. daisyUI's per-theme `color-scheme` handles dark styling.
const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('docsplus-theme')||'{}');var p=(s.state&&s.state.preference)||'light';var m=${JSON.stringify(PREFERENCE_TO_THEME)};var t=m[p]||(window.matchMedia('(prefers-color-scheme:dark)').matches?'docsplus-dark':'docsplus');document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

/**
 * This file owns only global PWA meta, icons, and fallback OG tags. Per-page
 * title/description/OG live in page-level <Head> because social crawlers run no
 * JavaScript, and HeadSeo.tsx (ssr:false) is invisible to them.
 */

const APP_NAME = 'docs.plus'
const THEME_COLOR_LIGHT = '#ffffff' // base-100 light
const THEME_COLOR_DARK = '#0b1220' // base-100 dark

// Every document page opens connections to these on boot (anon sign-in, doc
// metadata, collab WS) — warming them shaves the first-RTT handshakes.
const PRECONNECT_ORIGINS = (() => {
  const origins = new Set<string>()
  for (const url of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_RESTAPI_URL]) {
    try {
      if (url) origins.add(new URL(url).origin)
    } catch {
      // malformed env value — skip
    }
  }
  return [...origins]
})()

const WS_DNS_PREFETCH_HREF = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_PROVIDER_URL ?? '')
    return `${url.protocol === 'wss:' ? 'https:' : 'http:'}//${url.host}`
  } catch {
    return null
  }
})()

export default function Document() {
  return (
    <Html lang="en" data-theme="docsplus">
      <Head>
        <meta charSet="utf-8" />

        {PRECONNECT_ORIGINS.map((origin) => (
          <link key={origin} rel="preconnect" href={origin} crossOrigin="anonymous" />
        ))}
        {WS_DNS_PREFETCH_HREF && <link rel="dns-prefetch" href={WS_DNS_PREFETCH_HREF} />}

        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari PWA - required for standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content={APP_NAME} />

        <meta
          name="theme-color"
          content={THEME_COLOR_LIGHT}
          media="(prefers-color-scheme: light)"
        />
        <meta name="theme-color" content={THEME_COLOR_DARK} media="(prefers-color-scheme: dark)" />
        <meta name="msapplication-TileColor" content={THEME_COLOR_LIGHT} />

        {/* Favicons — browser tab only, deliberately not in the manifest */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />

        {/* Apple Touch Icons must be in HTML — Apple ignores the manifest */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />

        <link rel="mask-icon" href="/icons/logo.svg" color={THEME_COLOR_LIGHT} />

        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="address=no" />
        <meta name="format-detection" content="email=no" />

        <meta name="referrer" content="no-referrer" />

        {/* Global defaults only — title/description/url/image are set per-page */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={APP_NAME} />

        {/* Twitter card type — per-page tags override title/desc/image */}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
