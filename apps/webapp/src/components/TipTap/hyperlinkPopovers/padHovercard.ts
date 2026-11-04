import type { HovercardData, HovercardOptions } from '@docs.plus/extension-hyperlink'
import { authStore, selectIsSignedIn, useLinkPreviewStore } from '@stores'

import { fetchMetadata } from './fetchMetadata'
import { linkDestination } from './internalDocumentLink'
import { createSiteIcon } from './previewShared'
import type { LinkCard } from './types'

/** The setting is signed-in only (A9). A signed-out reader keeps the default, even after an "off". */
export const hoverPreviewsOn = (): boolean =>
  !selectIsSignedIn(authStore.getState()) || useLinkPreviewStore.getState().showOnHover

/** The host-only fallback card has no real title, so the card shows its "no preview" line. */
const toHovercardData = (card: LinkCard | null): HovercardData | null => {
  if (!card) return null
  if (card.fallback) return {}
  const { title, description, image, kind, facts } = card
  return { title, description, image, kind, facts }
}

/**
 * Desktop pad only (#242), web links only. The extension owns this card; the pad supplies data
 * and gates. A docs.plus link gets the webapp's own card (`padLinkCard/PadLinkHovercard.tsx`).
 */
export const padHovercard = {
  fetchMetadata: ({ href }) => fetchMetadata(href).then(toHovercardData),
  siteIcon: ({ href }) => createSiteIcon(href, 'hyperlink-hovercard__site-icon'),
  shouldShow: ({ href }) => hoverPreviewsOn() && linkDestination(href).kind === 'web',
  imageLayout: 'cover'
} satisfies HovercardOptions
