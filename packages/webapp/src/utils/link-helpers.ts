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
 */
export const sanitizeMetadata = (raw: Record<string, unknown>): LinkMetadata => {
  const str = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined

  return {
    title: str(raw.title),
    description: str(raw.description),
    icon: str(raw.icon) || str(raw.favicon),
    themeColor: str(raw.themeColor)
  }
}
