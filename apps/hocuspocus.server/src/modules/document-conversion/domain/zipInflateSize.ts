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

/** The walk refused the archive because its `word/*.xml` parts together unpack past `wordBudget`. */
export const PART_TOO_LARGE = 'part-too-large'

/** Top-level Word parts. mammoth holds each one it reads as a single string. */
export const WORD_PART = /^word\/[^/]+\.xml$/

/** The walk refused the archive because its `word/*.xml` parts hold more than `tagBudget` paragraph and run tags. */
export const TOO_MANY_TAGS = 'too-many-tags'

const LT = 0x3c
const COLON = 0x3a
const P = 0x70
const R = 0x72

// `>`, `/` or XML whitespace ends the name, so `<w:pPr>` and `<w:rPr>` do not count.
const endsName = (byte: number | undefined): boolean =>
  byte === 0x3e || byte === 0x2f || byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d

/**
 * Counts start tags whose local name is `p` or `r`, under any prefix or none: mammoth reads
 * namespaces, so `<x:p>` is a paragraph too. A name stops at the next `<`, which keeps the scan
 * linear. Stops once the count passes `room`.
 */
const countTags = (part: Buffer, room: number): number => {
  let tags = 0
  for (let at = part.indexOf(LT); at !== -1 && tags <= room; at = part.indexOf(LT, at + 1)) {
    let local = at + 1
    let end = local
    while (end < part.length && part[end] !== LT && !endsName(part[end])) {
      if (part[end] === COLON) local = end + 1
      end += 1
    }
    if (end - local === 1 && (part[local] === P || part[local] === R)) tags += 1
  }
  return tags
}

/**
 * Measured inflate, not declared size — a bomb states whatever it likes.
 * Abandoned as soon as the running total passes `budget`. `null` means the
 * container could not be read, such as ZIP64 or an unknown method, and the
 * caller refuses it as `422`.
 */
export const zipInflateSize = (
  zip: Buffer,
  budget: number,
  wordBudget: number,
  tagBudget: number
): number | null | typeof ENTRY_COUNT_MISMATCH | typeof PART_TOO_LARGE | typeof TOO_MANY_TAGS => {
  const eocd = zip.length >= EOCD_BYTES ? findEocd(zip) : null
  if (eocd === null) return null
  if (!countsAgree(zip, eocd)) return ENTRY_COUNT_MISMATCH

  const entries = zip.readUInt16LE(eocd + 10)
  let at = zip.readUInt32LE(eocd + 16)
  let total = 0
  let words = 0
  let tags = 0

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
    const isWord = WORD_PART.test(name)
    const wordCapped = isWord && wordBudget - words < budget - total
    let part: Buffer

    if (method === METHOD_STORED) {
      part = zip.subarray(from, from + compressed)
    } else if (method === METHOD_DEFLATE) {
      try {
        part = inflateRawSync(zip.subarray(from, from + compressed), {
          maxOutputLength: Math.max(1, wordCapped ? wordBudget - words : budget - total)
        })
      } catch (error) {
        if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
          return wordCapped ? PART_TOO_LARGE : budget + 1
        }
        // Corrupt or truncated DEFLATE stream (e.g. Z_DATA_ERROR, Z_BUF_ERROR):
        // unreadable container, not an over-budget bomb, so the caller returns 422.
        return null
      }
    } else {
      return null
    }

    total += part.length
    if (isWord) words += part.length
    // Catches a stored part, and the one byte `maxOutputLength` admits past a spent budget.
    if (words > wordBudget) return PART_TOO_LARGE
    if (total > budget) return total
    // Bytes do not bound parse memory: one-letter paragraphs cost far more per byte than prose.
    if (isWord) {
      tags += countTags(part, tagBudget - tags)
      if (tags > tagBudget) return TOO_MANY_TAGS
    }

    at += centralHeaderLength(zip, at)
  }

  return total
}
