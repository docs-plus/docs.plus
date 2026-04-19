const PRIVATE_172_RANGE_RE = /^172\.(1[6-9]|2\d|3[01])\./
const CGNAT_RANGE_RE = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./
const BENCHMARK_RANGE_RE = /^198\.(1[89])\./
const MULTICAST_RANGE_RE = /^(22[4-9]|23\d)\./

/**
 * Normalize hosts that wrap an IPv4 address inside an IPv6 envelope
 * (e.g. `[::ffff:127.0.0.1]` or `[::ffff:7f00:1]`) back to the
 * dotted-quad form so the IPv4 rules below catch them. Returns the input
 * unchanged when no mapping applies.
 */
const stripIpv4Mapped = (host: string): string => {
  const m = host.match(/^\[::ffff:([0-9a-f:.]+)\]$/i)
  if (!m) return host
  const inner = m[1]
  if (/^\d+\.\d+\.\d+\.\d+$/.test(inner)) return inner
  const hex = inner.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (hex) {
    const a = parseInt(hex[1], 16)
    const b = parseInt(hex[2], 16)
    return `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`
  }
  return host
}

/**
 * Reject URLs that point at the loopback interface, RFC 1918 private
 * ranges, link-local addresses, or `*.local` / `*.internal` mDNS-style
 * hostnames. Only `http:` and `https:` schemes are allowed.
 *
 * NOTE: This is a hostname-string check, not DNS resolution. It catches
 * the obvious SSRF vectors (cloud metadata endpoints, intranet hosts).
 * A determined attacker can still abuse DNS rebinding; that's an
 * acceptable v1 risk because the endpoint runs in our own egress-firewalled
 * Docker network — same threat model as the existing Next.js endpoint
 * this code replaces.
 */
export const isSafeUrl = (rawUrl: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = stripIpv4Mapped(parsed.hostname.toLowerCase().replace(/\.$/, ''))

  if (host === 'localhost' || host === '[::1]' || host === '[::]') return false
  if (host.startsWith('[fc') || host.startsWith('[fd')) return false
  if (
    host.startsWith('[fe8') ||
    host.startsWith('[fe9') ||
    host.startsWith('[fea') ||
    host.startsWith('[feb')
  )
    return false
  if (host.startsWith('[ff')) return false

  if (host.startsWith('127.')) return false
  if (host.startsWith('10.')) return false
  if (host.startsWith('192.168.')) return false
  if (PRIVATE_172_RANGE_RE.test(host)) return false
  if (host.startsWith('169.254.')) return false
  if (host.startsWith('0.')) return false
  if (CGNAT_RANGE_RE.test(host)) return false
  if (BENCHMARK_RANGE_RE.test(host)) return false
  if (MULTICAST_RANGE_RE.test(host)) return false
  if (host === '255.255.255.255') return false

  if (host.endsWith('.local') || host.endsWith('.internal')) return false

  return true
}
