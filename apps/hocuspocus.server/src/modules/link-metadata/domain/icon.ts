export const ICON_MAX_BYTES_DEFAULT = 16384

const MIN_SNIFF_BYTES = 16

/**
 * True only for a bare origin with no explicit port. `new URL` normalizes case,
 * default ports, IPv4 numbers and IDN, so any rewrite fails the compare. That
 * keeps one cache key per site, and the host stays the punycode form.
 */
export const isIconOrigin = (raw: string): boolean => {
  try {
    const url = new URL(raw)
    return url.origin === raw && url.port === ''
  } catch {
    return false
  }
}

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
export const sniffIconType = (bytes: Uint8Array): string | null => {
  if (bytes.length < MIN_SNIFF_BYTES) return null
  if (startsWith(bytes, PNG)) return 'image/png'
  if (startsWith(bytes, ICO) && (bytes[4] | (bytes[5] << 8)) > 0) return 'image/x-icon'
  if (startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A)) return 'image/gif'
  if (startsWith(bytes, JPEG)) return 'image/jpeg'
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'image/webp'
  return null
}
