import { parse } from 'tldts'

import { ICON_HTML_MAX_BYTES, pickIconHref } from './iconLinks'
import { readHead } from './readHead'
import { fetchImage, isMiss, openHop, statusMiss } from './relay'
import type { Miss, RelayedImage } from './types'

export const ICON_MAX_BYTES_DEFAULT = 32768

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

/**
 * The site's origin for its icon: the registrable domain, by the ICANN suffix list only. A host
 * label can carry data an agent was tricked into writing, and even a DNS lookup of
 * `<data>.attacker.example` sends it out. An IP passes as is. Null when no domain applies.
 */
export const iconSiteOrigin = (origin: string): string | null => {
  const url = new URL(origin)
  const host = parse(url.hostname)
  if (host.isIp) return origin
  return host.domain ? `${url.protocol}//${host.domain}` : null
}

// The page head names the icon when `/favicon.ico` has none, as on notion.so.
const fetchHtmlIcon = async (
  origin: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const { hop, response: pending } = openHop(`${origin}/`, signal, 'text/html')
  let href: string | null
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    const head = new TextDecoder().decode(await readHead(response, hop, ICON_HTML_MAX_BYTES))
    href = pickIconHref(head, response.url || `${origin}/`)
  } finally {
    hop.abort()
  }
  return href ? fetchImage(href, signal, maxBytes) : 'clean'
}

/**
 * `/favicon.ico` first, then the page head. A favicon throw means the origin itself failed,
 * so it propagates and the HTML step never runs. An HTML-step throw counts as 'error', and
 * 'error' beats 'clean', so a retryable failure keeps the short miss header.
 */
export const fetchSiteIcon = async (
  origin: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const favicon = await fetchImage(`${origin}/favicon.ico`, signal, maxBytes)
  if (!isMiss(favicon)) return favicon
  const fallback = await fetchHtmlIcon(origin, signal, maxBytes).catch((): Miss => 'error')
  if (!isMiss(fallback)) return fallback
  return favicon === 'error' || fallback === 'error' ? 'error' : 'clean'
}
