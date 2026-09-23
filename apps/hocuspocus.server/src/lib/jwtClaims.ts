import { isRecord } from './isRecord'

/**
 * Reads a JWT payload without checking the signature. Call it only on a token
 * that `verifySupabaseTokenOutcome` has already accepted: Supabase Auth checked
 * the signature then, so a second network call would add nothing.
 */
export const decodeJwtClaims = (token: string): Record<string, unknown> | null => {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return isRecord(claims) ? claims : null
  } catch {
    return null
  }
}

/**
 * An OAuth grant mints `client_id`; a browser session never does. Such a token
 * belongs to `/api/mcp` only, so every other user surface refuses it.
 */
export const isConnectedAppToken = (token: string): boolean =>
  decodeJwtClaims(token)?.client_id !== undefined
