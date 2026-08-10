/**
 * Reads a response body under a hard byte cap.
 *
 * Content-Length is whatever the peer chose to declare, so the cap is enforced on
 * the stream. Aborting the caller's controller stops the transfer itself rather
 * than draining bytes nobody will read. Returns `null` when the cap is passed.
 */
export const readCappedBody = async (
  response: Response,
  controller: AbortController,
  cap: number
): Promise<Uint8Array | null> => {
  if (!response.body) {
    const body = new Uint8Array(await response.arrayBuffer())
    return body.byteLength > cap ? null : body
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > cap) {
        controller.abort()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
