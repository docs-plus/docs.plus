import type { SignatureCheck } from '../types'

interface SignatureHeaders {
  id: string | undefined
  timestamp: string | undefined
  signature: string | undefined
}

/** The tolerance the Svix libraries use. It bounds how long a captured request can be replayed. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

const MESSAGE_ID = /^msg_[A-Za-z0-9]{1,64}$/
const UNIX_SECONDS = /^\d{1,12}$/

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> | null => {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

/**
 * Standard Webhooks check over the raw body bytes, Web Crypto only.
 * `crypto.subtle.verify` compares in constant time. `svix-signature` may list
 * several `v1,<base64>` entries during a secret rotation; any one may match.
 */
export async function verifySignature(
  secret: string,
  headers: SignatureHeaders,
  body: Uint8Array,
  nowSeconds: number
): Promise<SignatureCheck> {
  const { id, timestamp, signature } = headers
  if (!id || !MESSAGE_ID.test(id) || !timestamp || !UNIX_SECONDS.test(timestamp) || !signature) {
    return 'malformed'
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return 'expired'

  const keyBytes = decodeBase64(
    secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  )
  if (!keyBytes) return 'mismatch'
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const prefix = new TextEncoder().encode(`${id}.${timestamp}.`)
  const signed = new Uint8Array(prefix.length + body.length)
  signed.set(prefix)
  signed.set(body, prefix.length)

  for (const entry of signature.split(' ')) {
    const [version, encoded] = entry.split(',', 2)
    if (version !== 'v1' || !encoded) continue
    const candidate = decodeBase64(encoded)
    if (candidate && (await crypto.subtle.verify('HMAC', key, candidate, signed))) return 'valid'
  }
  return 'mismatch'
}
