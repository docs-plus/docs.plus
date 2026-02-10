import { Head, Html, Main, NextScript } from 'next/document'

/**
 * PWA & Meta Tags Strategy (DRY):
 * ─────────────────────────────────────────────────────────────
 * _document.tsx owns:
 *   - PWA meta (manifest, apple-mobile-web-app-*, theme-color)
 *   - Favicons (<link rel="icon">) — browser tab icons
 *   - Apple Touch Icons (<link rel="apple-touch-icon">) — Apple ignores manifest
 *   - Base fallback OG tags (og:type, og:site_name only)
 *
 * Page components own (server-rendered via <Head> from next/head):
 *   - og:title, og:description, og:url, og:image (per-page, SSR)
 *   - twitter:title, twitter:description, twitter:image (per-page, SSR)
 *   - <title>, <meta name="description"> (per-page, SSR)
 *
 * HeadSeo.tsx owns:
 *   - Client-side dynamic updates (title changes, description changes)
 *   - NOTE: NOT visible to social crawlers (ssr:false) — page-level <Head> is the SSR source
 *
 * Why this split matters:
 *   Social crawlers (Slack, Discord, Twitter, Facebook, iMessage, LinkedIn)
 *   do NOT execute JavaScript. They only see server-rendered HTML.
 *   Page-level <Head> tags from getServerSideProps are the ONLY way
 *   to get per-document link previews working.
 * ─────────────────────────────────────────────────────────────
 */

const APP_NAME = 'docs.plus'
const THEME_COLOR = '#2778ff'

export default function Document() {
  return (
    <Html lang="en" data-theme="docsyLight">
      <Head>
        {/* Character encoding - must be first */}
        <meta charSet="utf-8" />

        {/* ── PWA Core ──────────────────────────────────────── */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari PWA - required for standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />

        {/* Android Chrome PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content={APP_NAME} />

        {/* Theme color - browser chrome, status bar, task switcher */}
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="msapplication-TileColor" content={THEME_COLOR} />

        {/* ── Favicons (browser tab only — NOT in manifest) ── */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />

        {/* ── Apple Touch Icons (Apple ignores manifest — HTML only) ── */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />

        {/* Safari pinned tab icon (monochrome SVG) */}
        <link rel="mask-icon" href="/icons/logo.svg" color={THEME_COLOR} />

        {/* ── Disable auto-detection ────────────────────────── */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="address=no" />
        <meta name="format-detection" content="email=no" />

        {/* ── SEO ───────────────────────────────────────────── */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />

        {/*
          ── OG Base (fallback only) ──────────────────────────
          og:title, og:description, og:url, og:image are set per-page
          in page components via server-rendered <Head> from next/head.
          Only og:type and og:site_name are global defaults.
        */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={APP_NAME} />

        {/* Twitter card type — per-page tags override title/desc/image */}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
