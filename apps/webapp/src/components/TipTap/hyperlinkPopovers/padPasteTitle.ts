import type { PasteTitleOptions } from '@docs.plus/extension-hyperlink'
import { linkPreviewOn } from '@stores'

import { fetchMetadata } from './fetchMetadata'

/**
 * Live pad only. `signal` is not passed on: callers of one URL share one request, so an
 * abort would also cancel the hover that follows. The engine's deadline drops a late title.
 * The fallback card's title is the host name, so it keeps the URL.
 */
export const padPasteTitle: PasteTitleOptions = {
  fetchTitle: ({ href }) =>
    fetchMetadata(href).then((card) => (card && !card.fallback && card.title ? card.title : null)),
  shouldFetch: () => linkPreviewOn('pasteTitles')
}
