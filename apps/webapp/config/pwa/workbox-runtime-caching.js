const defaultCache = require('next-pwa/cache')
const { shouldBypassServiceWorker } = require('../security/third-party-hosts')

// Host suffix list: config/security/third-party-hosts.js (shared with next.config.js CSP).
// Page-level Script load failures: GoogleAnalytics.tsx swallowOptionalScriptError.

function wrapUrlPattern(pattern) {
  if (pattern instanceof RegExp) {
    return (context) => {
      if (shouldBypassServiceWorker(context.url)) return false
      return pattern.test(context.url.href)
    }
  }
  if (typeof pattern === 'function') {
    return (context) => {
      if (shouldBypassServiceWorker(context.url)) return false
      return pattern(context)
    }
  }
  if (typeof pattern === 'string') {
    const re = new RegExp(pattern)
    return (context) => {
      if (shouldBypassServiceWorker(context.url)) return false
      return re.test(context.url.href)
    }
  }
  return pattern
}

// next-pwa's catch-all cross-origin NetworkFirst + generic `.js` rule intercept
// third-party embed/analytics scripts; when network fails (CSP, ad blockers) Workbox
// surfaces uncaught `no-response` promises. Bypass those hosts so the browser handles them.
module.exports = defaultCache.map((route) => ({
  ...route,
  urlPattern: wrapUrlPattern(route.urlPattern)
}))
