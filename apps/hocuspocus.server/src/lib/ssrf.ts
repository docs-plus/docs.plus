import { lookup } from 'node:dns/promises'

const PRIVATE_172_RANGE_RE = /^172\.(1[6-9]|2\d|3[01])\./
const CGNAT_RANGE_RE = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./
const BENCHMARK_RANGE_RE = /^198\.(1[89])\./
const MULTICAST_RANGE_RE = /^(22[4-9]|23\d)\./
const IPV6_LINK_LOCAL_RE = /^fe[89ab]/

const unbracket = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

/**
 * Unwrap IPv4-in-IPv6 hosts (`::ffff:127.0.0.1`, `::ffff:7f00:1`) back to
 * dotted-quad so the IPv4 rules below catch them; anything else passes through.
 */
const stripIpv4Mapped = (host: string): string => {
  const m = host.match(/^::ffff:([0-9a-f:.]+)$/i)
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

/** Ranges no outbound request may reach, over a bare address with no brackets. */
const isPrivateAddress = (address: string): boolean => {
  const host = stripIpv4Mapped(address.toLowerCase())

  if (host === '::1' || host === '::') return true
  if (host.startsWith('fc') || host.startsWith('fd')) return true
  if (IPV6_LINK_LOCAL_RE.test(host)) return true
  if (host.startsWith('ff')) return true

  if (host.startsWith('127.')) return true
  if (host.startsWith('10.')) return true
  if (host.startsWith('192.168.')) return true
  if (PRIVATE_172_RANGE_RE.test(host)) return true
  if (host.startsWith('169.254.')) return true
  if (host.startsWith('0.')) return true
  if (CGNAT_RANGE_RE.test(host)) return true
  if (BENCHMARK_RANGE_RE.test(host)) return true
  if (MULTICAST_RANGE_RE.test(host)) return true
  if (host === '255.255.255.255') return true

  return false
}

const isIpLiteral = (host: string): boolean =>
  host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)

/**
 * A hostname-string check. It rejects the address ranges above plus every
 * single-label name, which is the shape a container or LAN host takes. A
 * registered name whose DNS points somewhere private still passes here, so
 * callers that actually connect must pair this with `resolvesToPublicAddress`.
 */
export const isSafeUrl = (rawUrl: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = unbracket(parsed.hostname.toLowerCase().replace(/\.$/, ''))
  if (!host) return false

  if (host === 'localhost') return false
  if (host.endsWith('.local') || host.endsWith('.internal')) return false
  if (isPrivateAddress(host)) return false

  // Every backend and observability container shares one Docker network, so
  // `redis` or `docsplus-grafana` resolves from here while matching no range
  // rule above. A public link never has a single-label host.
  if (!isIpLiteral(host) && !host.includes('.')) return false

  return true
}

/** `lookup` takes no signal, so a stage timeout could not cut a slow resolver short. */
const rejectOnAbort = (signal: AbortSignal): Promise<never> =>
  new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })

/**
 * Resolve the host and refuse it if any answer is private. This is what stops
 * an ordinary registered domain pointing at 127.0.0.1. It is not a rebinding
 * defence, since `fetch` resolves again on its own — that risk stays accepted.
 */
export const resolvesToPublicAddress = async (
  rawUrl: string,
  signal?: AbortSignal | null
): Promise<boolean> => {
  let host: string
  try {
    host = unbracket(new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, ''))
  } catch {
    return false
  }

  if (isIpLiteral(host)) return !isPrivateAddress(host)

  try {
    const resolving = lookup(host, { all: true })
    const answers = await (signal ? Promise.race([resolving, rejectOnAbort(signal)]) : resolving)
    return answers.length > 0 && answers.every(({ address }) => !isPrivateAddress(address))
  } catch {
    // `lookup` and `fetch` share one getaddrinfo, so a name this cannot resolve
    // is a name fetch cannot reach either. There is no split where refusing here
    // prevents a private connection, only one where it needs live DNS.
    return true
  }
}
