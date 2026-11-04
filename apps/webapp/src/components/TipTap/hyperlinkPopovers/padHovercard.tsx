import type { HovercardData, HovercardOptions } from '@docs.plus/extension-hyperlink'
import { linkPreviewOn } from '@stores'

import { fetchMetadata } from './fetchMetadata'
import { HovercardLinkLine } from './HovercardLinkLine'
import { Band, LinkTextWarning, Note } from './HovercardParts'
import { HovercardPlaceholder } from './HovercardPlaceholder'
import { mountHovercardView } from './HovercardPortal'
import { linkDestination } from './internalDocumentLink'
import { NoPreviewCard } from './NoPreviewCard'
import { noPreviewView } from './noPreviewView'
import { loadCardView } from './padLinkCard/loadCard'
import type { CardView } from './padLinkCard/model'
import { PadLinkCard } from './padLinkCard/PadLinkCard'
import type { LinkCard } from './types'
import { WebLinkCard } from './WebLinkCard'

/** A web page fills the page fields. A docs.plus link fills only `pad`. */
type PadHovercardData = HovercardData &
  Partial<Pick<LinkCard, 'kind' | 'facts' | 'miss'>> & {
    pad?: CardView
  }

/** The host-only fallback card has no real title, so the card says why there is no preview. */
const toWebData = (card: LinkCard | null): PadHovercardData | null => {
  if (!card) return null
  // A fallback, or a file the server only named, is no preview: the no-preview card draws it.
  if (card.fallback || card.file) return { miss: card.miss }
  const { title, description, image, kind, facts } = card
  return { title, description, image, kind, facts }
}

/**
 * Desktop pad only (#242). The extension runs the hover; the pad supplies data, gates and
 * every card: the rich web card, the no-preview card, and the pad card for docs.plus links.
 */
export const padHovercard = {
  fetchMetadata: ({ href, editor }): Promise<PadHovercardData | null> => {
    const to = linkDestination(href)
    if (to.kind === 'pad' || to.kind === 'here') {
      return loadCardView(to, editor).then((pad) => (pad ? { pad } : null))
    }
    return fetchMetadata(href).then(toWebData)
  },
  shouldShow: ({ href }) => linkPreviewOn('showOnHover') && linkDestination(href).kind !== 'other',
  render: (ctx) => {
    const { href, open } = ctx
    const { kind } = linkDestination(href)
    const pad = kind === 'pad' || kind === 'here'
    const data = ctx.state === 'data' ? ctx.data : null
    const title = data?.title
    // From the loading state on, so the warning never arrives late with the data.
    const warning = pad ? null : <LinkTextWarning text={ctx.link.textContent ?? ''} href={href} />
    // A real card wins even for a file path. With no preview, a file names its kind.
    const noPreview =
      pad || title || ctx.state === 'loading' ? null : noPreviewView(href, data?.miss)
    return mountHovercardView(
      <>
        {ctx.state === 'loading' ? (
          <HovercardPlaceholder>{warning}</HovercardPlaceholder>
        ) : pad ? (
          data?.pad ? (
            <PadLinkCard href={href} view={data.pad} onOpen={open} />
          ) : (
            <Band>
              <Note>No preview for this page.</Note>
            </Band>
          )
        ) : title ? (
          <WebLinkCard href={href} data={{ ...data, title }} onOpen={open}>
            {warning}
          </WebLinkCard>
        ) : (
          noPreview && (
            <NoPreviewCard
              href={href}
              title={noPreview.title}
              path={noPreview.path}
              miss={data?.miss}
              onOpen={open}>
              {warning}
            </NoPreviewCard>
          )
        )}
        <HovercardLinkLine
          href={href}
          pad={pad}
          reason={noPreview?.reason}
          onApplyTitle={ctx.applyTitle}
          onOpen={open}
        />
      </>
    )
  }
} satisfies HovercardOptions<PadHovercardData>
