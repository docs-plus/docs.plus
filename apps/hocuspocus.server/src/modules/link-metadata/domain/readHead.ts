const HEAD_CLOSE = '</head'

/**
 * Every tag we read sits in `<head>`. So the read stops at `</head`, or at `cap`, and returns
 * the bytes before it. The result never depends on how the network split the page, and the rest
 * is never downloaded. The search reads latin1, so one char is one byte.
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
      const at = window.toLowerCase().indexOf(HEAD_CLOSE)
      if (at !== -1) {
        total -= window.length - at
        break
      }
      tail = window.slice(-HEAD_CLOSE.length)
    }
  } finally {
    reader.releaseLock()
  }
  hop.abort()
  return Buffer.concat(chunks).subarray(0, total)
}
