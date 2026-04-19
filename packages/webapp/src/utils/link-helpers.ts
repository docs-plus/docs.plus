import { type LinkItem, type LinkMetadata, LinkType } from '@types'

/**
 * Build the correct href for a link based on its type.
 */
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

/**
 * Build a Google Favicon Service URL for any domain.
 * Always returns a valid, cached PNG — industry-standard approach
 * used by Notion, Raindrop, Arc, etc.
 * Returns undefined for non-URL types (email/phone) or invalid URLs.
 */
export const getGoogleFaviconUrl = (url: string, size: 32 | 64 = 32): string | undefined => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    const { origin } = new URL(withProtocol)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=${size}`
  } catch {
    return undefined
  }
}

/**
 * Sanitize raw API metadata response into a clean LinkMetadata object.
 * Strips unused fields (socialBanner, socialBannerSize, etc.) and
 * ensures all values are either valid strings or undefined.
 * Falls back icon -> favicon for best icon availability.
 *
 * Image URLs are gated to http(s) only — a hostile metadata source could
 * otherwise smuggle a `data:` or `javascript:` URL into the icon slot
 * which is later rendered into `<img src>` somewhere downstream.
 */
export const sanitizeMetadata = (raw: Record<string, unknown>): LinkMetadata => {
  const str = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined

  const httpStr = (val: unknown): string | undefined => {
    const s = str(val)
    return s && /^https?:\/\//i.test(s) ? s : undefined
  }

  const publisher =
    raw.publisher && typeof raw.publisher === 'object'
      ? (raw.publisher as Record<string, unknown>)
      : undefined

  return {
    title: str(raw.title),
    description: str(raw.description),
    icon: httpStr(raw.icon) || httpStr(raw.favicon),
    themeColor: str(publisher?.theme_color) || str(raw.themeColor)
  }
}
