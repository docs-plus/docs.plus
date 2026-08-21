/**
 * Reads a response body under a hard byte cap. Content-Length is whatever the peer
 * chose to declare, so the cap is enforced on the stream. Aborting the caller's
 * controller stops the transfer rather than draining bytes nobody will read.
 * Returns `null` when the cap is passed or the response carries no body.
 */
export const readCappedBody = async (
  response: Response,
  controller: AbortController,
  cap: number
): Promise<Buffer | null> => {
  if (!response.body) return null

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

  return Buffer.concat(chunks, total)
}
