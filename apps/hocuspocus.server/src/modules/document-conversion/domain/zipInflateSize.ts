import { inflateRawSync } from 'node:zlib'

const CENTRAL_SIGNATURE = 0x02014b50
const EOCD_SIGNATURE = 0x06054b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_BYTES = 22
const CENTRAL_HEADER_BYTES = 46
const LOCAL_HEADER_BYTES = 30
const METHOD_STORED = 0
const METHOD_DEFLATE = 8
/** The comment field is 16-bit, so the record starts within this much of the tail. */
const MAX_EOCD_SEARCH = 0xffff + EOCD_BYTES

const findEocd = (zip: Buffer): number | null => {
  const floor = Math.max(0, zip.length - MAX_EOCD_SEARCH)
  for (let at = zip.length - EOCD_BYTES; at >= floor; at -= 1) {
    if (zip.readUInt32LE(at) === EOCD_SIGNATURE) return at
  }
  return null
}

/** Where the entry's payload starts — the local header repeats the name and extra fields at its own lengths. */
const payloadStart = (zip: Buffer, localAt: number): number | null => {
  if (localAt + LOCAL_HEADER_BYTES > zip.length) return null
  if (zip.readUInt32LE(localAt) !== LOCAL_SIGNATURE) return null
  return (
    localAt + LOCAL_HEADER_BYTES + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28)
  )
}

/**
 * Measured inflate, not declared size — a bomb states whatever it likes.
 * Abandoned as soon as the running total passes `budget`. `null` means the
 * container could not be read, so the converter gives the verdict instead.
 */
export const zipInflateSize = (zip: Buffer, budget: number): number | null => {
  const eocd = zip.length >= EOCD_BYTES ? findEocd(zip) : null
  if (eocd === null) return null

  const entries = zip.readUInt16LE(eocd + 10)
  let at = zip.readUInt32LE(eocd + 16)
  let total = 0

  for (let entry = 0; entry < entries; entry += 1) {
    if (at + CENTRAL_HEADER_BYTES > zip.length) return null
    if (zip.readUInt32LE(at) !== CENTRAL_SIGNATURE) return null

    const method = zip.readUInt16LE(at + 10)
    const compressed = zip.readUInt32LE(at + 20)
    const from = payloadStart(zip, zip.readUInt32LE(at + 42))
    if (from === null || from + compressed > zip.length) return null

    if (method === METHOD_STORED) {
      total += compressed
    } else if (method === METHOD_DEFLATE) {
      try {
        total += inflateRawSync(zip.subarray(from, from + compressed), {
          maxOutputLength: Math.max(1, budget - total)
        }).length
      } catch {
        // Either the entry alone blew the remaining budget or the stream is corrupt.
        // Both are refusals, and the caller reads any over-budget total the same way.
        return budget + 1
      }
    } else {
      return null
    }

    if (total > budget) return total

    at +=
      CENTRAL_HEADER_BYTES +
      zip.readUInt16LE(at + 28) +
      zip.readUInt16LE(at + 30) +
      zip.readUInt16LE(at + 32)
  }

  return total
}
