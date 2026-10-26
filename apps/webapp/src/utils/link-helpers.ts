import type { Editor } from '@tiptap/core'
import { type LinkItem, type LinkMetadata, LinkType } from '@types'

import { apiBaseUrl } from './apiBaseUrl'
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
 * Our REST icon route. A miss is an empty 404, so each <img> needs onError.
 * Credentials are refused because `mailto:a@b.com` parses as user `mailto` at `b.com`.
 */
export const getSiteIconUrl = (url: string): string | undefined => {
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`)
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password)
      return undefined
    return `${apiBaseUrl()}/metadata/icon?origin=${encodeURIComponent(u.origin)}`
  } catch {
    return undefined // also covers apiBaseUrl() throwing when the variable is unset
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
    icon: httpStr(raw.icon),
    themeColor: str(publisher?.theme_color) || str(raw.themeColor)
  }
}

/** Deep-link to a chatroom message. */
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
