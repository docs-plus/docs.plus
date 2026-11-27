// A page may omit `</head>`; its `<body` still ends the head, so the body never reaches it.
const HEAD_ENDS = ['</head', '<body']
const CARRY = Math.max(...HEAD_ENDS.map((end) => end.length))

/** How far past the head end the html stage reads, for JSON-LD scripts only. */
export interface TailLimit {
  bytes: number
  ms: number
}

type Reader = {
  read(): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }>
}

const EMPTY = new Uint8Array(0)

/** The first head end in `text`, or -1. */
export const firstHeadEnd = (text: string): number => {
  const found = HEAD_ENDS.map((end) => text.indexOf(end)).filter((at) => at !== -1)
  return found.length > 0 ? Math.min(...found) : -1
}

const LT = 0x3c
// Each head end after its `<`, as lower-case ASCII bytes.
const END_TAILS = HEAD_ENDS.map((end) => Buffer.from(end.slice(1), 'latin1'))

/** True when a head end starts at the `<` at `at`. Letters match in either case. */
const isHeadEnd = (bytes: Uint8Array, at: number): boolean => {
  for (const tail of END_TAILS) {
    let i = 0
    for (; i < tail.length; i += 1) {
      const want = tail[i]
      const got = bytes[at + 1 + i]
      if (got !== want && !(want >= 0x61 && want <= 0x7a && got === want - 0x20)) break
    }
    if (i === tail.length) return true
  }
  return false
}

/** A cheap first test for `</h` or `<bo` in either case. Most tags fail it. */
const mayEnd = (bytes: Uint8Array, at: number): boolean => {
  const first = bytes[at + 1] | 0x20
  const second = bytes[at + 2] | 0x20
  return first === 0x2f ? second === 0x68 : first === 0x62 && second === 0x6f
}

// One native search per `<` is slow on a tag-dense head, so short gaps are scanned in place.
const NEAR = 16

/**
 * The first head end in `chunk`, as an offset into it, or null. It is negative when the end
 * starts in `carry`, the last bytes before the chunk. Bytes are searched as they are: a string copy of
 * each chunk and its lower-case copy cost 2 to 3 MiB per 1 MiB head.
 */
const findHeadEnd = (carry: Uint8Array, chunk: Uint8Array): number | null => {
  if (carry.byteLength > 0) {
    const seam = Buffer.concat([carry, chunk.subarray(0, CARRY)])
    for (
      let at = seam.indexOf(LT);
      at !== -1 && at < carry.byteLength;
      at = seam.indexOf(LT, at + 1)
    )
      if (isHeadEnd(seam, at)) return at - carry.byteLength
  }
  for (let at = chunk.indexOf(LT); at !== -1;) {
    if (mayEnd(chunk, at) && isHeadEnd(chunk, at)) return at
    const stop = Math.min(at + NEAR, chunk.byteLength)
    let next = at + 1
    while (next < stop && chunk[next] !== LT) next += 1
    at = next < stop ? next : chunk.indexOf(LT, stop)
  }
  return null
}

/**
 * Reads until the first `</head` or `<body`, or `cap`. `bytes` may run past `headEnd`, because a
 * chunk can hold both. `done` means the stream ended. The search keeps the last bytes of each
 * chunk, so the cut never depends on how the network split the page.
 */
const readToHeadEnd = async (
  reader: Reader,
  cap: number
): Promise<{ bytes: Uint8Array; headEnd: number; done: boolean }> => {
  const chunks: Uint8Array[] = []
  let total = 0
  let carry: Uint8Array = EMPTY
  while (total < cap) {
    const next = await reader.read()
    if (next.done) return { bytes: Buffer.concat(chunks, total), headEnd: total, done: true }
    const chunk = next.value.subarray(0, cap - total)
    chunks.push(chunk)
    const start = total
    total += chunk.byteLength
    const at = findHeadEnd(carry, chunk)
    if (at !== null)
      return { bytes: Buffer.concat(chunks, total), headEnd: start + at, done: false }
    // A head end may start in the last CARRY - 1 bytes and finish in the next chunk.
    carry =
      chunk.byteLength >= CARRY - 1
        ? chunk.subarray(chunk.byteLength - (CARRY - 1))
        : Buffer.concat([carry, chunk]).subarray(-(CARRY - 1))
  }
  return { bytes: Buffer.concat(chunks, total), headEnd: total, done: false }
}

/**
 * The head, and `readTail` to read on past the head end: `tail.bytes` at most, within `tail.ms`,
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
    const initial = bytes.subarray(headEnd, headEnd + limit)
    if (done || initial.byteLength >= limit) return { bytes: initial, cut: false }
    const chunks: Uint8Array[] = [initial]
    let total = initial.byteLength
    let cut = false
    const timer = setTimeout(() => hop.abort(), tail.ms)
    try {
      while (total < limit) {
        const next = await reader.read().catch(() => null)
        if (!next) cut = true
        if (!next || next.done) break
        const chunk = next.value.subarray(0, limit - total)
        chunks.push(chunk)
        total += chunk.byteLength
      }
    } finally {
      clearTimeout(timer)
    }
    return { bytes: Buffer.concat(chunks, total), cut }
  }

  return { head: bytes.subarray(0, headEnd), readTail }
}

/**
 * The bytes before the first `</head` or `<body`, or the first `cap` bytes. The caller aborts `hop`
 * after this, so the rest is never downloaded.
 */
export const readHead = async (
  response: Response,
  hop: AbortController,
  cap: number
): Promise<Uint8Array> => (await readPage(response, hop, cap)).head
