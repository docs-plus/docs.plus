import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const isProduction = process.env.NODE_ENV === 'production'

/** Optional analytics — ad blockers may reject gtag.js (SW bypass: config/pwa/workbox-runtime-caching.js). */
function swallowOptionalScriptError() {}

export default function GoogleAnalytics() {
  if (!GA_ID || !isProduction) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        onError={swallowOptionalScriptError}
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
