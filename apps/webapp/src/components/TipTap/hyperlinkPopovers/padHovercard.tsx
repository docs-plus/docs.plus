import type { HovercardData, HovercardOptions } from '@docs.plus/extension-hyperlink'
import { authStore, selectIsSignedIn, useLinkPreviewStore } from '@stores'

import { fetchMetadata } from './fetchMetadata'
import { HovercardLinkLine } from './HovercardLinkLine'
import { HovercardPlaceholder } from './HovercardPlaceholder'
import { mountHovercardView } from './HovercardPortal'
import { linkDestination } from './internalDocumentLink'
import { loadCardView } from './padLinkCard/loadCard'
import type { CardView } from './padLinkCard/model'
import { PadLinkCard } from './padLinkCard/PadLinkCard'
import type { LinkCard, WebCardData } from './types'
import { WebLinkCard } from './WebLinkCard'

/** A web page fills the page fields. A docs.plus link fills only `pad`. */
type PadHovercardData = HovercardData &
  Partial<Pick<WebCardData, 'kind' | 'facts'>> & {
    pad?: CardView
  }

/** The setting is signed-in only (A9). A signed-out reader keeps the default, even after an "off". */
const hoverPreviewsOn = (): boolean =>
  !selectIsSignedIn(authStore.getState()) || useLinkPreviewStore.getState().showOnHover

/** The host-only fallback card has no real title, so the card shows its "no preview" line. */
const toWebData = (card: LinkCard | null): PadHovercardData | null => {
  if (!card) return null
  if (card.fallback) return {}
  const { title, description, image, kind, facts } = card
  return { title, description, image, kind, facts }
}

/**
 * Desktop pad only (#242). The extension runs the hover; the pad supplies data, gates and
 * both cards: the rich web card, and the pad card for a link into docs.plus.
 */
export const padHovercard = {
  fetchMetadata: ({ href, editor }): Promise<PadHovercardData | null> => {
    const to = linkDestination(href)
    if (to.kind === 'pad' || to.kind === 'here') {
      return loadCardView(to, editor).then((pad) => (pad ? { pad } : null))
    }
    return fetchMetadata(href).then(toWebData)
  },
  shouldShow: ({ href }) => hoverPreviewsOn() && linkDestination(href).kind !== 'other',
  render: (ctx) => {
    const { href, open } = ctx
    const { kind } = linkDestination(href)
    const pad = kind === 'pad' || kind === 'here'
    const data = ctx.state === 'data' ? ctx.data : null
    const title = data?.title
    return mountHovercardView(
      <>
        {pad && data?.pad ? (
          <PadLinkCard href={href} view={data.pad} onOpen={open} />
        ) : !pad && title ? (
          <WebLinkCard href={href} data={{ ...data, title }} onOpen={open} />
        ) : (
          <HovercardPlaceholder state={ctx.state === 'loading' ? 'loading' : 'empty'} />
        )}
        <HovercardLinkLine href={href} pad={pad} onOpen={open} />
      </>
    )
  }
} satisfies HovercardOptions<PadHovercardData>
