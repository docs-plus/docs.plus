/** Build-time CSP host registry — consumed by next.config.js. */

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

/** Giphy search API + CDN fetches for composer GIF picker. */
const GIPHY_CONNECT_HOSTS = ['api.giphy.com', 'media.giphy.com', 'i.giphy.com']

/**
 * GlitchTip error-reporting host, derived from NEXT_PUBLIC_GLITCHTIP_DSN at build
 * time so the Sentry SDK's POST to it isn't blocked by connect-src. Empty when no
 * DSN is set (DSN-gated, like the SDK init itself).
 */
let GLITCHTIP_CONNECT_HOSTS = []
try {
  if (process.env.NEXT_PUBLIC_GLITCHTIP_DSN) {
    GLITCHTIP_CONNECT_HOSTS = [new URL(process.env.NEXT_PUBLIC_GLITCHTIP_DSN).host]
  }
} catch {
  GLITCHTIP_CONNECT_HOSTS = [] // malformed DSN — leave connect-src untouched
}

module.exports = {
  X_SCRIPT_HOSTS,
  X_SYNDICATION_HOSTS,
  X_PUBLISH_HOSTS,
  X_CONNECT_HOSTS,
  IFRAME_EMBED_HOSTS,
  GA_CONNECT_HOSTS,
  GIPHY_CONNECT_HOSTS,
  GLITCHTIP_CONNECT_HOSTS
}
