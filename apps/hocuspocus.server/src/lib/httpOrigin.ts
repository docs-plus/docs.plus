import { isIP } from 'node:net'

export interface ParsedOrigin {
  origin: string
  protocol: 'http:' | 'https:'
  host: string
  port: number
}

/** Expands a valid IPv6 literal (with optional zone id or embedded IPv4) into 8 16-bit groups. */
export const expandIpv6 = (ip: string): number[] | null => {
  if (isIP(ip) !== 6) return null
  const zoneIdx = ip.indexOf('%')
  const bare = zoneIdx === -1 ? ip : ip.slice(0, zoneIdx)
  const dbl = bare.indexOf('::')
  if (dbl !== -1 && bare.indexOf('::', dbl + 2) !== -1) return null

  const parseSide = (side: string): number[] | null => {
    if (!side) return []
    const parts = side.split(':')
    const out: number[] = []
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!
      if (part.includes('.')) {
        if (i !== parts.length - 1) return null
        const octets = part.split('.').map(Number)
        if (octets.length !== 4) return null
        out.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!)
      } else {
        const val = parseInt(part, 16)
        if (!Number.isInteger(val) || val < 0 || val > 0xffff) return null
        out.push(val)
      }
    }
    return out
  }

  const head = dbl === -1 ? parseSide(bare) : parseSide(bare.slice(0, dbl))
  const tail = dbl === -1 ? [] : parseSide(bare.slice(dbl + 2))
  if (!head || !tail) return null
  const missing = 8 - head.length - tail.length
  if (dbl === -1 ? missing !== 0 : missing < 1) return null
  return [...head, ...Array<number>(missing).fill(0), ...tail]
}

/**
 * Strips IPv6 brackets, decodes IPv4-mapped `::ffff:` (both dotted-quad and
 * WHATWG hex-grouped) to dotted-quad IPv4, and canonicalizes `::` / `::1`.
 */
export const normalizeHost = (host: string): string => {
  const unbracketed = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  const lower = unbracketed.toLowerCase()
  const groups = expandIpv6(lower)
  if (groups) {
    if (
      groups[0] === 0 &&
      groups[1] === 0 &&
      groups[2] === 0 &&
      groups[3] === 0 &&
      groups[4] === 0 &&
      groups[5] === 0xffff
    ) {
      return `${groups[6]! >> 8}.${groups[6]! & 0xff}.${groups[7]! >> 8}.${groups[7]! & 0xff}`
    }
    if (groups.every((g) => g === 0)) return '::'
    if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return '::1'
  }
  return lower
}

/**
 * Parses a bare `http(s)` origin with no path, query, fragment, or credentials.
 * Returns `null` for anything else.
 */
export const parseBareHttpOrigin = (raw: string): ParsedOrigin | null => {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return null
  }
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return {
    origin: parsed.origin,
    protocol: parsed.protocol,
    host: normalizeHost(parsed.hostname),
    port
  }
}
