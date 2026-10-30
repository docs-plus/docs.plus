import type { HovercardOptions } from '@docs.plus/extension-hyperlink'
import { authStore, selectIsSignedIn, useLinkPreviewStore } from '@stores'

import { fetchMetadata, metadataImageUrl } from './fetchMetadata'
import { classifyInternalDocumentLink } from './internalDocumentLink'
import { createSiteIcon } from './previewShared'

// The setting is signed-in only (A9). A signed-out reader keeps the default, even after an "off".
const hoverPreviewsOn = (): boolean =>
  !selectIsSignedIn(authStore.getState()) || useLinkPreviewStore.getState().showOnHover

/** Desktop pad only (#242). The extension owns the card; the pad supplies data and gates. */
export const padHovercard = {
  // A new object: the response is the shared cache entry that the click preview also reads.
  fetchMetadata: async ({ href }) => {
    const res = await fetchMetadata(href)
    if (!res) return null
    const src = metadataImageUrl(href, res)
    return { ...res, image: src ? { url: src } : undefined }
  },
  siteIcon: ({ href }) => createSiteIcon(href, 'hyperlink-hovercard__site-icon'),
  shouldShow: ({ href }) =>
    hoverPreviewsOn() && !classifyInternalDocumentLink(href, window.location.pathname),
  imageLayout: 'cover'
} satisfies HovercardOptions
