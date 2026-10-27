const HEAD_CLOSE = '</head'

/**
 * Every tag we read sits in `<head>`. So the read stops after the chunk that holds `</head`,
 * or at `cap`, and never downloads the rest. That last chunk stays whole; a caller that must
 * not see the body cuts at the tag. The search reads latin1, so one char is one byte.
 */
export const readHead = async (
  response: Response,
  hop: AbortController,
  cap: number
): Promise<Uint8Array> => {
  if (!response.body) return new Uint8Array(0)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let tail = ''
  try {
    while (total < cap) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, total)
      const chunk = value.subarray(0, cap - total)
      chunks.push(chunk)
      total += chunk.byteLength
      const window =
        tail + Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('latin1')
      if (window.toLowerCase().includes(HEAD_CLOSE)) break
      tail = window.slice(-HEAD_CLOSE.length)
    }
  } finally {
    reader.releaseLock()
  }
  hop.abort()
  return Buffer.concat(chunks, total)
}
