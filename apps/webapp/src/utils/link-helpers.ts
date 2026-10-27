import type { Editor } from '@tiptap/core'
import { type LinkItem, type LinkMetadata, LinkType } from '@types'

import { headingSlugTrail } from './headingSlugTrail'
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

/**
 * Our REST icon route. A miss is an empty 204, so each <img> needs onError.
 * Credentials are refused because `mailto:a@b.com` parses as user `mailto` at `b.com`.
 */
export const getSiteIconUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    if (!isHttp || parsed.username || parsed.password) return undefined
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
