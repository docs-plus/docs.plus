const defaultCache = require('next-pwa/cache')

// next-pwa serializes each route's urlPattern via Function.toString() into sw.js.
// Matchers must be self-contained: no module-scope references inside urlPattern
// functions or the worker throws ReferenceError on intercept.

// Default next-pwa rules 3/5/6 and 13 intercept cross-origin media. SW fetch() uses
// connect-src; page img/media tags use img-src/media-src (we allow https:). Do not
// enumerate remote hosts in connect-src — skip SW for cross-origin image/audio/video.
let adapted = 0

const cache = defaultCache.map((route) => {
  const pattern = route.urlPattern

  if (
    route.handler === 'StaleWhileRevalidate' &&
    pattern instanceof RegExp &&
    pattern.source.includes('jpg|jpeg')
  ) {
    adapted++
    return {
      ...route,
      urlPattern: ({ url }) => {
        if (self.origin !== url.origin) return false
        return /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i.test(url.href)
      }
    }
  }

  if (route.handler === 'CacheFirst' && pattern instanceof RegExp) {
    if (pattern.source.includes('mp3|wav|ogg')) {
      adapted++
      return {
        ...route,
        urlPattern: ({ url }) => {
          if (self.origin !== url.origin) return false
          return /\.(?:mp3|wav|ogg)$/i.test(url.href)
        }
      }
    }
    if (pattern.source.includes('mp4')) {
      adapted++
      return {
        ...route,
        urlPattern: ({ url }) => {
          if (self.origin !== url.origin) return false
          return /\.(?:mp4)$/i.test(url.href)
        }
      }
    }
  }

  if (route.handler === 'NetworkFirst' && typeof pattern === 'function') {
    // Rule 13 (cross-origin catch-all) uniquely returns `!isSameOrigin` directly;
    // rules 11/12 are same-origin NetworkFirst for pages/data and use
    // `if (!isSameOrigin) return false` + pathname logic — must stay untouched.
    if (pattern.toString().includes('return !isSameOrigin')) {
      adapted++
      return {
        ...route,
        urlPattern: ({ url, request }) => {
          if (self.origin === url.origin) return false
          const dest = request.destination
          if (dest === 'image' || dest === 'audio' || dest === 'video') return false
          return true
        }
      }
    }
  }

  return route
})

// Fail the build loud if a next-pwa bump renames/reorders/retitles these rules:
// a silent fall-through would re-intercept cross-origin media and reinstate the
// CSP connect-src prod bug with code that still "looks fine".
const EXPECTED_ADAPTED = 4
if (adapted !== EXPECTED_ADAPTED) {
  throw new Error(
    `[workbox-runtime-caching] adapted ${adapted} cross-origin media rules, expected ${EXPECTED_ADAPTED}. ` +
      `The next-pwa default cache changed — re-verify the rule discriminators.`
  )
}

module.exports = cache
