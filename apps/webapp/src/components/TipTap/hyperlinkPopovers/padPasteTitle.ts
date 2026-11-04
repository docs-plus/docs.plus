import type { PasteTitleOptions } from '@docs.plus/extension-hyperlink'
import { linkPreviewOn } from '@stores'
import type { PadFacets } from '@types'

import { fetchMetadata } from './fetchMetadata'
import { classifyPadFacets, linkDestination } from './internalDocumentLink'
import { cardQuery, hovercardUrl, parseCardReply } from './padLinkCard/model'

/**
 * The swap writes text every reader sees, so this asks as nobody: no token, no cookie.
 * A Private pad then answers `locked` and keeps its URL.
 */
const publicPadTitle = async (pad: PadFacets, signal: AbortSignal): Promise<string | null> => {
  const link = classifyPadFacets(pad)
  if (link.kind !== 'document' && link.kind !== 'heading') return null
  const response = await fetch(hovercardUrl(pad.slug, cardQuery(link)), {
    credentials: 'omit',
    signal
  })
  if (!response.ok) return null
  const body: { data?: unknown } | null = await response.json()
  const reply = parseCardReply(body?.data)
  if (!reply || 'locked' in reply) return null
  if (reply.kind === 'pad') return reply.title
  return reply.kind === 'heading' ? `${reply.title} · ${reply.padTitle}` : null
}

/**
 * Live pad only. A web link reads the shared `fetchMetadata` request, so its `signal` is not
 * passed on: an abort would also cancel the hover after it. The engine's deadline drops a late
 * title. The fallback card's title is the host name, so it keeps the URL.
 */
export const padPasteTitle: PasteTitleOptions = {
  fetchTitle: ({ href, signal }) => {
    const destination = linkDestination(href)
    if (destination.kind === 'pad') return publicPadTitle(destination.pad, signal)
    return fetchMetadata(href).then((card) =>
      card && !card.fallback && card.title ? card.title : null
    )
  },
  shouldFetch: ({ href }) =>
    linkPreviewOn(linkDestination(href).kind === 'pad' ? 'padPasteTitles' : 'pasteTitles')
}
