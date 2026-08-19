import type { Editor } from '@tiptap/core'
import { type LinkItem, type LinkMetadata, LinkType } from '@types'

import { headingSlugTrail } from './headingSlugTrail'

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
 * Google's favicon service always answers with a cached PNG, so there is no
 * broken-image case. undefined means the input was not a URL (email, phone).
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
 * Image URLs are gated to http(s) only. A hostile metadata source could otherwise
 * smuggle a `data:` or `javascript:` URL into the icon slot. That slot is rendered
 * into an `<img src>` downstream.
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

/** Deep-link to a chatroom message. Mirrors `BookmarkItem.handleCopyUrl` byte-for-byte. */
export const buildBookmarkHref = (args: { messageId: string; channelId: string }): string => {
  const url = new URL(window.location.href)
  url.searchParams.set('msg_id', args.messageId)
  url.searchParams.set('chatroom', args.channelId)
  return url.toString()
}

/** Deep-link to a heading. `h` is the outline parent chain; `id` is the resolver. */
export const buildHeadingHref = (editor: Editor, headingId: string): string => {
  const url = new URL(window.location.href)
  url.searchParams.set('h', headingSlugTrail(editor, headingId))
  url.searchParams.set('id', headingId)
  return url.toString()
}
