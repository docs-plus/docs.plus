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

const centralHeaderLength = (zip: Buffer, at: number): number =>
  CENTRAL_HEADER_BYTES +
  zip.readUInt16LE(at + 28) +
  zip.readUInt16LE(at + 30) +
  zip.readUInt16LE(at + 32)

/** The walk refused the archive because its directory and its EOCD disagree. */
export const ENTRY_COUNT_MISMATCH = 'entry-count-mismatch'

// The EOCD counts are declared, like sizes. A reader that trusts a smaller count
// than the directory holds measures fewer entries than the converter opens.
const countsAgree = (zip: Buffer, eocd: number): boolean => {
  const onDisk = zip.readUInt16LE(eocd + 8)
  const total = zip.readUInt16LE(eocd + 10)
  let walked = 0
  for (
    let at = zip.readUInt32LE(eocd + 16);
    at + CENTRAL_HEADER_BYTES <= zip.length && zip.readUInt32LE(at) === CENTRAL_SIGNATURE;
    at += centralHeaderLength(zip, at)
  ) {
    walked += 1
  }
  return onDisk === total && walked === total
}

/** The walk refused the archive because one `word/*.xml` part unpacks past `partBudget`. */
export const PART_TOO_LARGE = 'part-too-large'

/** Top-level Word parts. mammoth holds each one it reads as a single string. */
export const WORD_PART = /^word\/[^/]+\.xml$/

/**
 * Measured inflate, not declared size — a bomb states whatever it likes.
 * Abandoned as soon as the running total passes `budget`. `null` means the
 * container could not be read, such as ZIP64 or an unknown method, and the
 * caller refuses it as `422`.
 */
export const zipInflateSize = (
  zip: Buffer,
  budget: number,
  partBudget: number
): number | null | typeof ENTRY_COUNT_MISMATCH | typeof PART_TOO_LARGE => {
  const eocd = zip.length >= EOCD_BYTES ? findEocd(zip) : null
  if (eocd === null) return null
  if (!countsAgree(zip, eocd)) return ENTRY_COUNT_MISMATCH

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
    const name = zip.toString(
      'latin1',
      at + CENTRAL_HEADER_BYTES,
      at + CENTRAL_HEADER_BYTES + zip.readUInt16LE(at + 28)
    )
    const partCapped = WORD_PART.test(name) && partBudget < budget - total

    if (method === METHOD_STORED) {
      if (partCapped && compressed > partBudget) return PART_TOO_LARGE
      total += compressed
    } else if (method === METHOD_DEFLATE) {
      try {
        total += inflateRawSync(zip.subarray(from, from + compressed), {
          maxOutputLength: Math.max(1, partCapped ? partBudget : budget - total)
        }).length
      } catch (error) {
        if (partCapped && (error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
          return PART_TOO_LARGE
        }
        // Either the entry alone blew the remaining budget or the stream is corrupt.
        // Both are refusals, and the caller reads any over-budget total the same way.
        return budget + 1
      }
    } else {
      return null
    }

    if (total > budget) return total

    at += centralHeaderLength(zip, at)
  }

  return total
}
