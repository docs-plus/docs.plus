import { readCappedBody } from '../../../lib/readCappedBody'
import { safeFetch } from './ssrf'
import { BOT_USER_AGENT, type Miss, type RelayedImage, type StreamedImage } from './types'

const MIN_SNIFF_BYTES = 16

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, i) => bytes[offset + i] === byte)

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const ICO = [0x00, 0x00, 0x01, 0x00] as const
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] as const
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const
const JPEG = [0xff, 0xd8, 0xff] as const
const RIFF = [0x52, 0x49, 0x46, 0x46] as const
const WEBP = [0x57, 0x45, 0x42, 0x50] as const

/** The served `Content-Type` comes from these bytes only, never from the upstream header. */
export const sniffImageType = (bytes: Uint8Array): string | null => {
  if (bytes.length < MIN_SNIFF_BYTES) return null
  if (startsWith(bytes, PNG)) return 'image/png'
  if (startsWith(bytes, ICO) && (bytes[4] | (bytes[5] << 8)) > 0) return 'image/x-icon'
  if (startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A)) return 'image/gif'
  if (startsWith(bytes, JPEG)) return 'image/jpeg'
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'image/webp'
  return null
}

// These upstream answers may change soon, so the miss is cached for a short time only.
const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429

export const statusMiss = (status: number): Miss => (isRetryableStatus(status) ? 'error' : 'clean')

/**
 * Each hop gets its own controller under the route's one timer. An over-cap read
 * aborts only its own hop, so the icon route's HTML step can still run after it.
 */
export const openHop = (url: string, signal: AbortSignal, accept: string) => {
  const hop = new AbortController()
  const response = safeFetch(url, {
    signal: AbortSignal.any([signal, hop.signal]),
    headers: { 'User-Agent': BOT_USER_AGENT, Accept: accept }
  })
  return { hop, response }
}

export const fetchImage = async (
  url: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const { hop, response: pending } = openHop(url, signal, 'image/*')
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    return await bufferImage(response, hop, maxBytes)
  } finally {
    hop.abort()
  }
}

const bufferImage = async (
  response: Response,
  hop: AbortController,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const bytes = await readCappedBody(response, hop, maxBytes)
  const type = bytes && sniffImageType(bytes)
  // A view, not a copy: a second copy of every image doubled the relay's memory (#786).
  return type
    ? {
        bytes: new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength),
        type
      }
    : 'clean'
}

// Only `read` is used; Bun's own reader type adds methods the DOM type lacks.
type ByteReader = {
  read(): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }>
}

// A chunked image body is buffered whole, so only this many read at once (#786).
const MAX_BUFFERED_RELAYS = 32
let bufferedRelays = 0

/**
 * The body size the upstream declared, or null. Fetch unzips a coded body but keeps the coded
 * `content-length`, so a coded body counts as undeclared and is buffered.
 */
const declaredLength = (response: Response): number | null => {
  const coding = response.headers.get('content-encoding')
  if (coding && coding.trim().toLowerCase() !== 'identity') return null
  const value = response.headers.get('content-length')
  return value && /^\d+$/.test(value) ? Number(value) : null
}

/** The first bytes for the sniff, or null when the body ends or passes `length` first. */
const readSniffBytes = async (reader: ByteReader, length: number): Promise<Uint8Array | null> => {
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MIN_SNIFF_BYTES) {
    const { done, value } = await reader.read()
    if (done) return null
    chunks.push(value)
    total += value.byteLength
  }
  if (total > length) return null
  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, total)
}

/**
 * Sends the sniffed head, then each upstream chunk as it arrives. A body shorter or longer
 * than its declared length errors the stream, so the browser sees a failed load, never a
 * cut image under a day of cache.
 */
const passThrough = (
  reader: ByteReader,
  head: Uint8Array,
  length: number,
  hop: AbortController
): ReadableStream<Uint8Array> => {
  let sent = head.byteLength
  const finish = () => hop.abort()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(head)
      if (sent === length) {
        controller.close()
        finish()
      }
    },
    async pull(controller) {
      const mismatch = () => new Error(`image body sent ${sent} of ${length} declared bytes`)
      try {
        // The stream closes at `length`, so an end before it is always a short body.
        const { done, value } = await reader.read()
        if (done) throw mismatch()
        sent += value.byteLength
        if (sent > length) throw mismatch()
        controller.enqueue(value)
        if (sent === length) {
          controller.close()
          finish()
        }
      } catch (error) {
        controller.error(error)
        finish()
      }
    },
    cancel: finish
  })
}

/**
 * The image route's relay (#786). A body that declares its length, up to `maxBytes`, streams
 * through after the sniff. A chunked body is buffered as before, and is 'busy' when
 * MAX_BUFFERED_RELAYS are already reading.
 */
export const relayImage = async (
  url: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<StreamedImage | RelayedImage | Miss | 'busy'> => {
  const { hop, response: pending } = openHop(url, signal, 'image/*')
  let streaming = false
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    const length = declaredLength(response)
    if (length === null) {
      if (bufferedRelays >= MAX_BUFFERED_RELAYS) return 'busy'
      bufferedRelays += 1
      try {
        return await bufferImage(response, hop, maxBytes)
      } finally {
        bufferedRelays -= 1
      }
    }
    if (length < MIN_SNIFF_BYTES || length > maxBytes || !response.body) return 'clean'
    const reader = response.body.getReader()
    const head = await readSniffBytes(reader, length)
    const type = head && sniffImageType(head)
    if (!head || !type) return 'clean'
    streaming = true
    return { body: passThrough(reader, head, length, hop), type }
  } finally {
    if (!streaming) hop.abort()
  }
}

export const isMiss = <T>(result: T | Miss): result is Miss =>
  result === 'clean' || result === 'error'
