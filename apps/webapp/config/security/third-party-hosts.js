/** Build-time CSP + Workbox host registry — consumed by next.config.js and config/pwa/workbox-runtime-caching.js. */

const X_SCRIPT_HOSTS = ['platform.twitter.com', 'platform.x.com']
const X_SYNDICATION_HOSTS = ['syndication.twitter.com', 'syndication.x.com']
const X_PUBLISH_HOSTS = ['publish.twitter.com', 'publish.x.com']

const X_CONNECT_HOSTS = [...X_PUBLISH_HOSTS, ...X_SYNDICATION_HOSTS, ...X_SCRIPT_HOSTS]

const IFRAME_EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'w.soundcloud.com',
  'www.loom.com'
]

/** GA4 collect endpoints beyond `*.google-analytics.com` wildcards in CSP. */
const GA_CONNECT_HOSTS = ['analytics.google.com']

/**
 * Hostname suffixes excluded from Workbox runtime routes (derived from embed + analytics hosts).
 * Subdomain match: `www.googletagmanager.com` matches suffix `googletagmanager.com`.
 */
const SW_BYPASS_HOST_SUFFIXES = [
  'googletagmanager.com',
  'google-analytics.com',
  ...GA_CONNECT_HOSTS,
  'doubleclick.net',
  ...X_CONNECT_HOSTS,
  'soundcloud.com',
  'youtube.com',
  'youtube-nocookie.com',
  'googlevideo.com',
  'ytimg.com',
  'vimeo.com',
  'loom.com'
]

function shouldBypassServiceWorker(url) {
  const { hostname } = url
  return SW_BYPASS_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  )
}

module.exports = {
  X_SCRIPT_HOSTS,
  X_SYNDICATION_HOSTS,
  X_PUBLISH_HOSTS,
  X_CONNECT_HOSTS,
  IFRAME_EMBED_HOSTS,
  GA_CONNECT_HOSTS,
  SW_BYPASS_HOST_SUFFIXES,
  shouldBypassServiceWorker
}
