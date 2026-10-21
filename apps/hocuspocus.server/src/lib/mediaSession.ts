import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The Private media cookie names a user, not a document, so one cookie covers
 * every Private document that user owns. The secret arrives as an argument, as in
 * `unsubscribeToken.ts`, because importing `config` would make this untestable.
 */
export const MEDIA_SESSION_COOKIE = 'dp_media'
// One hour, like the access token. The webapp posts again on every token refresh,
// so an open tab keeps it. A banned owner or a stolen cookie loses access within the hour.
export const MEDIA_SESSION_TTL_S = 3600
export const MEDIA_SESSION_PATH = '/api/plugins/hypermultimedia'

// `typ` keeps an unsubscribe token from passing here if both secrets are the same.
const MEDIA_SESSION_TYPE = 'media'

const sign = (payloadB64: string, secret: string): string =>
  createHmac('sha256', Buffer.from(secret, 'utf8')).update(payloadB64, 'utf8').digest('base64url')

export function signMediaSession(opts: {
  uid: string
  secret: string
  nowSeconds?: number
}): string {
  if (!opts.secret) throw new Error('MEDIA_COOKIE_SECRET is not set')
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  const payload = { typ: MEDIA_SESSION_TYPE, uid: opts.uid, exp: now + MEDIA_SESSION_TTL_S }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadB64}.${sign(payloadB64, opts.secret)}`
}

/** A `Cookie` header value for a server-side fetch as `uid`, or null when the secret is unset. */
export const mediaCookieHeader = (uid: string, secret: string): string | null =>
  secret ? `${MEDIA_SESSION_COOKIE}=${signMediaSession({ uid, secret })}` : null

/** The uid, or null for every rejection. An empty secret is a rejection too:
 *  anyone can compute an HMAC keyed on `''`. */
export function verifyMediaSession(opts: {
  value: string | undefined
  secret: string
  nowSeconds?: number
}): string | null {
  if (!opts.secret || !opts.value) return null
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)

  const parts = opts.value.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, provided] = parts as [string, string]

  const expected = Buffer.from(sign(payloadB64, opts.secret), 'utf8')
  const supplied = Buffer.from(provided, 'utf8')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null
  const { typ, uid, exp } = payload as Record<string, unknown>
  if (typ !== MEDIA_SESSION_TYPE || typeof uid !== 'string' || uid === '') return null
  if (typeof exp !== 'number' || exp < now) return null

  return uid
}
