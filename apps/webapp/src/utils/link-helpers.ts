import { type LinkItem, type LinkMetadata, LinkType } from '@types'

import { iconRouteUrl } from './iconRouteUrl'

export const getFormattedHref = (link: LinkItem): string => {
  switch (link.type) {
    case LinkType.Email:
      return link.url.startsWith('mailto:') ? link.url : `mailto:${link.url}`
    case LinkType.Phone:
      return link.url.startsWith('tel:') ? link.url : `tel:${link.url}`
    default:
      return link.url.startsWith('http') ? link.url : `https://${link.url}`
  }
}

/** True for an absolute http(s) URL. `mailto:`, `tel:`, app schemes and relative paths are not. */
export const isWebHref = (href: string | URL): boolean => {
  try {
    const { protocol } = new URL(href)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Our REST icon route. A miss is an empty 204, so each <img> needs onError.
 * Credentials are refused because `mailto:a@b.com` parses as user `mailto` at `b.com`.
 */
export const getSiteIconUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`)
    if (!isWebHref(parsed) || parsed.username || parsed.password) return undefined
    return iconRouteUrl(parsed.origin)
  } catch {
    return undefined // also covers apiBaseUrl() throwing when the variable is unset
  }
}

export const sanitizeMetadata = (raw: Record<string, unknown>): LinkMetadata => {
  const str = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined

  return {
    title: str(raw.title),
    description: str(raw.description)
  }
}
