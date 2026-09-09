/**
 * Both shapes of the one unsubscribe endpoint, so the route path is written
 * once. `next.config.js` rewrites `/unsubscribe` on the app domain to `ROUTE`
 * here; that rewrite is the only other place allowed to name this path.
 */
const ROUTE = '/api/email/unsubscribe'

/** What a reader clicks. Stays on the app domain, which a consent link needs. */
export const unsubscribeLinkUrl = (appUrl: string, token: string): string =>
  `${appUrl}/unsubscribe?token=${token}`

/** RFC 8058. A mail client POSTs this and runs no JavaScript, so it hits the API. */
export const oneClickUrl = (apiOrigin: string, token: string): string =>
  `${apiOrigin}${ROUTE}?token=${token}`
