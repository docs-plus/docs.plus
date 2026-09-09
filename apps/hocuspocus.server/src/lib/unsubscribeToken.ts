import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * One-click unsubscribe tokens. The token is the whole credential, so the link
 * needs no session. The secret arrives as an argument and never from `config`,
 * because that import validates the whole environment and would make this
 * module untestable. URL shapes live in `email/unsubscribeUrls.ts`.
 */
const UNSUBSCRIBE_ACTIONS = ['mentions', 'replies', 'reactions', 'digest', 'all'] as const

export type UnsubscribeAction = (typeof UNSUBSCRIBE_ACTIONS)[number]

/** `exp` is seconds, not milliseconds. */
export type UnsubscribePayload = { uid: string; act: UnsubscribeAction; exp: number }

const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60

const isAction = (value: string): value is UnsubscribeAction =>
  (UNSUBSCRIBE_ACTIONS as readonly string[]).includes(value)

/** base64url without padding, so the token needs no escaping in a query string. */
const toBase64Url = (input: Buffer): string =>
  input.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

const fromBase64Url = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

/** Fails closed. An unsigned link is worse than a missing one. */
const requireSecret = (secret: string): string => {
  if (!secret) throw new Error('EMAIL_UNSUBSCRIBE_SECRET is not set')
  return secret
}

// The signed message is the encoded payload's own characters, never the decoded JSON.
const sign = (payloadB64: string, secret: string): string =>
  toBase64Url(createHmac('sha256', Buffer.from(secret, 'utf8')).update(payloadB64, 'utf8').digest())

// Named fields, because `userId` and `secret` are both plain strings. Swapping
// two positional arguments would put the secret inside the payload, in a URL.
export function signUnsubscribeToken(opts: {
  userId: string
  action: UnsubscribeAction
  secret: string
  nowSeconds?: number
}): string {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  const payload: UnsubscribePayload = {
    uid: opts.userId,
    act: opts.action,
    exp: now + TOKEN_TTL_SECONDS
  }
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${payloadB64}.${sign(payloadB64, requireSecret(opts.secret))}`
}

/**
 * Null for every rejection, so a caller cannot tell a bad signature from an
 * expired one. Throws only on an absent secret, which is a deployment fault and
 * which the caller reports differently.
 */
export function verifyUnsubscribeToken(opts: {
  token: string
  secret: string
  nowSeconds?: number
}): UnsubscribePayload | null {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  const secret = requireSecret(opts.secret)

  const parts = opts.token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, provided] = parts as [string, string]

  const expected = Buffer.from(sign(payloadB64, secret), 'utf8')
  const supplied = Buffer.from(provided, 'utf8')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  let payload: unknown
  try {
    payload = JSON.parse(fromBase64Url(payloadB64).toString('utf8'))
  } catch {
    return null
  }

  // A forged payload cannot reach here, but a shape change across a deploy can.
  if (typeof payload !== 'object' || payload === null) return null
  const { uid, act, exp } = payload as Record<string, unknown>
  if (typeof uid !== 'string' || typeof act !== 'string' || !isAction(act)) return null
  if (typeof exp !== 'number' || exp < now) return null

  return { uid, act, exp }
}
