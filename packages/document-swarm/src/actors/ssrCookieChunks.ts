// Mirrors @supabase/ssr@0.12.1 (utils/chunker.ts + cookies.ts): the browser client
// persists sessions as chunked `sb-<ref>-auth-token` cookies, base64url-encoded with a
// `base64-` prefix. Verified byte-for-byte against that source before porting here.

const BASE64_PREFIX = 'base64-'
const MAX_CHUNK_SIZE = 3180

export type CookieChunk = { name: string; value: string }

/** Encodes session JSON the way @supabase/ssr stores auth-token cookie values. */
export function encodeSessionCookieValue(sessionJson: string): string {
  return `${BASE64_PREFIX}${Buffer.from(sessionJson, 'utf8').toString('base64url')}`
}

/**
 * Exact port of @supabase/ssr createChunks: splits on encodeURIComponent length at
 * unicode boundaries; a value that fits is written as a single cookie named exactly `key`.
 */
export function createChunks(key: string, value: string): CookieChunk[] {
  let encodedValue = encodeURIComponent(value)
  if (encodedValue.length <= MAX_CHUNK_SIZE) return [{ name: key, value }]

  const chunks: string[] = []
  while (encodedValue.length > 0) {
    let head = encodedValue.slice(0, MAX_CHUNK_SIZE)
    const lastEscapePos = head.lastIndexOf('%')
    if (lastEscapePos > MAX_CHUNK_SIZE - 3) head = head.slice(0, lastEscapePos)

    let valueHead = ''
    while (head.length > 0) {
      try {
        valueHead = decodeURIComponent(head)
        break
      } catch (error) {
        if (error instanceof URIError && head.at(-3) === '%' && head.length > 3) {
          head = head.slice(0, head.length - 3)
        } else {
          throw error
        }
      }
    }
    chunks.push(valueHead)
    encodedValue = encodedValue.slice(head.length)
  }
  return chunks.map((chunkValue, index) => ({ name: `${key}.${index}`, value: chunkValue }))
}
