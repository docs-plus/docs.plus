import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'
import { getSiteIconUrl } from '@utils/link-helpers'

import type { MetadataResponse } from './fetchMetadata'
import type { DocSelectionRange } from './types'

/**
 * Defense-in-depth over third-party JSON (oEmbed thumbnails, scraped meta):
 * `data:` URIs can carry scripted SVG and are a tracking-pixel vector, so only
 * plain http(s) passes. `undefined` makes the caller try the next candidate.
 */
const safeImageSrc = (url: string | undefined): string | undefined => {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}

type PreviewImageData = Pick<
  MetadataResponse,
  'icon' | 'favicon' | 'publisher' | 'image' | 'oembed'
> | null

/**
 * Preview image order: icon, publisher logo, image, site icon, oEmbed thumbnail.
 * `favicon` is only a fallback marker; we build our own URL from the href.
 */
export const pickPreviewImageSrc = (data: PreviewImageData, href: string): string | undefined =>
  safeImageSrc(data?.icon) ||
  safeImageSrc(data?.publisher?.logo) ||
  safeImageSrc(data?.image?.url) ||
  (data?.favicon ? getSiteIconUrl(href) : undefined) ||
  safeImageSrc(data?.oembed?.thumbnail)

/**
 * Link text from the document. The live <a> wins over a stale nodePos; the href match stops a neighbour's text.
 * DOM text is the last resort. Keep the body equal to the extension's internal copy; change both together.
 */
export const getHyperlinkDisplayText = (
  editor: Editor,
  at: { nodePos?: number; link?: HTMLAnchorElement; href?: string | null; markName?: string }
): string => {
  const { link, markName = 'hyperlink' } = at
  const fallback = () => link?.innerText ?? link?.textContent ?? ''
  const type = editor.schema.marks[markName]
  const { doc } = editor.state
  let live = -1
  try {
    if (link?.isConnected) live = editor.view.posAtDOM(link, 0)
  } catch {
    // An <a> outside this view gives -1, and live >= 0 handles that. This catch is only a guard.
  }
  const pos = live >= 0 ? live : at.nodePos
  if (!type || typeof pos !== 'number' || pos < 0 || pos > doc.content.size) return fallback()
  const href = at.href ?? link?.getAttribute('href')
  // href picks the mark; its full attrs then give the same range Apply edits.
  const $pos = doc.resolve(pos)
  const mark = [$pos.nodeAfter, $pos.nodeBefore]
    .flatMap((n) => n?.marks ?? [])
    .find((m) => m.type === type && (!href || m.attrs.href === href))
  const range = mark && getMarkRange($pos, type, mark.attrs)
  return range ? doc.textBetween(range.from, range.to, '') : fallback()
}

export const isValidDocRange = (docSize: number, from: number, to: number) =>
  from >= 0 && to <= docSize && from < to

export function resolveDocSelection(
  editor: Editor,
  snap: DocSelectionRange | null | undefined
): DocSelectionRange | undefined {
  const { from, to, empty } = editor.state.selection
  const docSize = editor.state.doc.content.size
  if (!empty && isValidDocRange(docSize, from, to)) return { from, to }
  if (snap && isValidDocRange(docSize, snap.from, snap.to)) return snap
  return undefined
}
