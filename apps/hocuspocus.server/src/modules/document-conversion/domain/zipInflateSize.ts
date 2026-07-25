const CENTRAL_SIGNATURE = 0x02014b50
const EOCD_SIGNATURE = 0x06054b50
const EOCD_BYTES = 22
const CENTRAL_HEADER_BYTES = 46
/** The comment field is 16-bit, so the record starts within this much of the tail. */
const MAX_EOCD_SEARCH = 0xffff + EOCD_BYTES

const findEocd = (zip: Buffer): number | null => {
  const floor = Math.max(0, zip.length - MAX_EOCD_SEARCH)
  for (let at = zip.length - EOCD_BYTES; at >= floor; at -= 1) {
    if (zip.readUInt32LE(at) === EOCD_SIGNATURE) return at
  }
  return null
}

/**
 * What the container claims it inflates to, summed over every entry. `null`
 * means the directory could not be read — the converter then owns the verdict,
 * so a merely unusual zip is not refused on this evidence.
 */
export const zipInflateSize = (zip: Buffer): number | null => {
  const eocd = zip.length >= EOCD_BYTES ? findEocd(zip) : null
  if (eocd === null) return null

  const entries = zip.readUInt16LE(eocd + 10)
  let at = zip.readUInt32LE(eocd + 16)
  let total = 0

  for (let entry = 0; entry < entries; entry += 1) {
    if (at + CENTRAL_HEADER_BYTES > zip.length) return null
    if (zip.readUInt32LE(at) !== CENTRAL_SIGNATURE) return null
    total += zip.readUInt32LE(at + 24)
    at +=
      CENTRAL_HEADER_BYTES +
      zip.readUInt16LE(at + 28) +
      zip.readUInt16LE(at + 30) +
      zip.readUInt16LE(at + 32)
  }

  return total
}
