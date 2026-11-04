const HEAD_CLOSE = '</head'

/** How far past `</head` the html stage reads, for JSON-LD scripts only. */
export interface TailLimit {
  bytes: number
  ms: number
}

type Reader = {
  read(): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }>
}

const EMPTY = new Uint8Array(0)

/**
 * Reads until the first `</head`, or `cap`. `bytes` may run past `headEnd`, because a chunk
 * can hold both. `done` means the stream ended. The search reads latin1, so one char is
 * one byte, and the cut never depends on how the network split the page.
 */
const readToHeadEnd = async (
  reader: Reader,
  cap: number
): Promise<{ bytes: Uint8Array; headEnd: number; done: boolean }> => {
  const chunks: Uint8Array[] = []
  let total = 0
  let carry = ''
  while (total < cap) {
    const next = await reader.read()
    if (next.done) return { bytes: Buffer.concat(chunks, total), headEnd: total, done: true }
    const chunk = next.value.subarray(0, cap - total)
    chunks.push(chunk)
    total += chunk.byteLength
    const window =
      carry + Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('latin1')
    const at = window.toLowerCase().indexOf(HEAD_CLOSE)
    if (at !== -1) {
      return {
        bytes: Buffer.concat(chunks, total),
        headEnd: total - (window.length - at),
        done: false
      }
    }
    carry = window.slice(-HEAD_CLOSE.length)
  }
  return { bytes: Buffer.concat(chunks, total), headEnd: total, done: false }
}

/**
 * The head, and `readTail` to read on past `</head`: `tail.bytes` at most, within `tail.ms`,
 * never past `cap`. A late or failed tail is `cut`, not thrown, because a second try may read
 * more. The caller aborts `hop` when it is done; that ends the read and frees the socket.
 */
export const readPage = async (
  response: Response,
  hop: AbortController,
  cap: number
): Promise<{
  head: Uint8Array
  readTail: (tail: TailLimit) => Promise<{ bytes: Uint8Array; cut: boolean }>
}> => {
  if (!response.body) {
    return { head: EMPTY, readTail: async () => ({ bytes: EMPTY, cut: false }) }
  }
  const reader = response.body.getReader()
  const { bytes, headEnd, done } = await readToHeadEnd(reader, cap)

  const readTail = async (tail: TailLimit) => {
    const limit = Math.min(cap - headEnd, tail.bytes)
    const chunks = [bytes.subarray(headEnd)]
    let total = chunks[0].byteLength
    let cut = false
    const timer = setTimeout(() => hop.abort(), tail.ms)
    try {
      while (!done && total < limit) {
        const next = await reader.read().catch(() => null)
        if (!next) cut = true
        if (!next || next.done) break
        chunks.push(next.value)
        total += next.value.byteLength
      }
    } finally {
      clearTimeout(timer)
    }
    return { bytes: Buffer.concat(chunks).subarray(0, limit), cut }
  }

  return { head: bytes.subarray(0, headEnd), readTail }
}

/**
 * The bytes before the first `</head`, or the first `cap` bytes. The caller aborts `hop`
 * after this, so the rest is never downloaded.
 */
export const readHead = async (
  response: Response,
  hop: AbortController,
  cap: number
): Promise<Uint8Array> => (await readPage(response, hop, cap)).head
