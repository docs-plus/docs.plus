import { conversionLogger } from '../../../lib/logger'
import { documentExportImagesDroppedTotal } from '../../../lib/metrics'
import { readCappedBody } from '../../../lib/readCappedBody'
import {
  EXPORT_IMAGE_TIMEOUT_MS,
  EXPORT_IMAGE_TOTAL_TIMEOUT_MS,
  MAX_EXPORT_IMAGE_BYTES,
  MAX_EXPORT_IMAGES,
  MAX_EXPORT_INLINED_BYTES,
  startsWith
} from '../types'
import type { ForeignImage } from './documentHtml'

/** Only `png` and `jpeg` carry a content type in the converter's hard-coded
 *  `[Content_Types].xml`, so any other extension yields an unreadable package. */
export type ExportImageMime = 'image/png' | 'image/jpeg'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

// A signature with no image behind it is still a stub: three bytes would satisfy
// the JPEG magic on their own and be inlined as a picture.
const MIN_SIGNATURE_BYTES = 16

/**
 * Positive identification only. The converter's detector falls through to every
 * parser it has for bytes it cannot place, so anything merely unrecognised still
 * reaches the ICNS, HEIF and JXL loops — dropping has to be the default arm.
 */
export const isSafeImageSignature = (bytes: Uint8Array): ExportImageMime | null => {
  if (bytes.byteLength < MIN_SIGNATURE_BYTES) return null
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
  return null
}

/** Logged per URL rather than per element, so one bad image in a document
 *  repeated fifty times writes one line. The counter does the counting. */
const fetchInlineable = async (url: string, cap: number): Promise<string | null> => {
  const drop = (reason: string): null => {
    conversionLogger.warn({ reason, url: url.slice(0, 200) }, 'Export image dropped')
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXPORT_IMAGE_TIMEOUT_MS)
  try {
    // A redirect would leave the allowlisted origin the caller already checked,
    // which is the hop the origin filter exists to refuse.
    const response = await fetch(url, { redirect: 'error', signal: controller.signal })
    if (!response.ok) return drop(`status ${response.status}`)

    const bytes = await readCappedBody(response, controller, cap)
    if (!bytes) return drop('larger than the per-image cap')

    const mime = isSafeImageSignature(bytes)
    if (!mime) return drop('not a png or jpeg')

    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  } catch (error) {
    return drop(error instanceof Error ? error.message : 'fetch failed')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The converter hands every image to a bundled `image-size` whose ICNS, HEIF and
 * JXL parsers loop forever, and it does that on the `data:` path too — so the
 * sniff is what closes the hang, and inlining only stops it opening a socket.
 * Callers must apply the origin allowlist first: this fetches what it is given.
 */
export const inlineExportImages = async (images: ForeignImage[]): Promise<void> => {
  const fetched = new Map<string, string | null>()
  const deadline = Date.now() + EXPORT_IMAGE_TOTAL_TIMEOUT_MS
  let remaining = MAX_EXPORT_INLINED_BYTES
  let inlined = 0

  // Serial on purpose. A pool lets three fetches read `remaining` before any of
  // them subtracts, which admitted 48 MB against a 40 MB cap when measured.
  for (const image of images) {
    const src = image.getAttribute('src') ?? ''
    // Bytes alone cannot end the run — a failed fetch charges nothing, so the
    // remainder stays positive forever once nothing more fits and every later
    // image still dials out. `inlined` caps what reaches the HTML string and
    // `fetched.size` caps sockets, which a run of failures would otherwise leave
    // unbounded because a failure inlines nothing.
    const spent =
      inlined >= MAX_EXPORT_IMAGES || fetched.size >= MAX_EXPORT_IMAGES || Date.now() > deadline
    if (!spent && !fetched.has(src)) {
      fetched.set(src, await fetchInlineable(src, Math.min(MAX_EXPORT_IMAGE_BYTES, remaining)))
    }

    // Charged per element, not per URL: N nodes sharing one src inline N copies.
    const dataUri = spent ? null : (fetched.get(src) ?? null)
    if (dataUri !== null && dataUri.length <= remaining) {
      remaining -= dataUri.length
      inlined += 1
      image.setAttribute('src', dataUri)
      continue
    }

    const reason = spent ? 'budget-spent' : dataUri === null ? 'unusable' : 'budget-exceeded'
    documentExportImagesDroppedTotal.inc({ reason })
    image.remove()
  }
}
