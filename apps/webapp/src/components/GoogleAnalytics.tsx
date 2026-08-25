import { getRoutePolicy } from '@utils/routePolicy'
import { useRouter } from 'next/router'
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const isProduction = process.env.NODE_ENV === 'production'

/** Optional analytics — ad blockers may reject gtag.js (SW bypass: config/pwa/workbox-runtime-caching.js). */
function swallowOptionalScriptError() {}

// A document's title and its `?h=` heading trail are text the user wrote, and GA4 sends both
// automatically as page_title and page_location. The document shell overrides them with a fixed
// placeholder, so events still report while the prose never leaves the browser.
const REDACTED_CONFIG = "{page_title:'(document)',page_location:location.origin+'/(document)'}"

export default function GoogleAnalytics() {
  const router = useRouter()
  const { analytics, documentShell } = getRoutePolicy(router.pathname)

  if (!GA_ID || !isProduction || !analytics) return null

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
          gtag('config', '${GA_ID}'${documentShell ? `, ${REDACTED_CONFIG}` : ''});
        `}
      </Script>
    </>
  )
}
