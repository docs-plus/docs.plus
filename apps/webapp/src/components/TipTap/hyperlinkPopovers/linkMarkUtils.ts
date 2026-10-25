import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

import type { DocSelectionRange } from './types'

/**
 * Defense-in-depth over third-party JSON (oEmbed thumbnails, scraped meta):
 * `data:` URIs can carry scripted SVG and are a tracking-pixel vector, so only
 * plain http(s) passes. `undefined` makes the caller try the next candidate.
 */
export const safeImageSrc = (url: string | undefined): string | undefined => {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}

/**
 * Kept minimal so both the desktop popover's `MetadataResponse` and the mobile
 * sheet's narrowed `LinkMetadata` satisfy it without conversion.
 */
export interface MarkMetadata {
  title: string
  image?: { url: string } | undefined
}

/**
 * Desktop MUST defer this until the popover detaches (use `renderMetadataInto`'s
 * `flush`): the attr write re-renders the `<a>`, and floating-ui's
 * `hide({ strategy: 'referenceHidden' })` then hides the popover. The mobile
 * sheet isn't anchored to the link DOM, so it can write immediately.
 */
export const writeLinkMetadataAttrs = (
  editor: Editor,
  nodePos: number,
  href: string,
  data: MarkMetadata
): void => {
  const { state } = editor
  const node = state.doc.nodeAt(nodePos)
  if (!node) return

  const hyperlinkType = state.schema.marks.hyperlink
  if (!hyperlinkType) return

  const existingMark = node.marks.find((m) => m.type === hyperlinkType && m.attrs.href === href)
  if (!existingMark) return

  const range = getMarkRange(state.doc.resolve(nodePos), hyperlinkType, { href })
  if (!range) return

  const nextAttrs = {
    ...existingMark.attrs,
    title: data.title,
    image: data.image?.url
  }
  if (
    existingMark.attrs.title === nextAttrs.title &&
    existingMark.attrs.image === nextAttrs.image
  ) {
    return
  }

  const nextMark = hyperlinkType.create(nextAttrs)
  // Background metadata is not an undoable user action.
  const tr = state.tr
    .removeMark(range.from, range.to, hyperlinkType)
    .addMark(range.from, range.to, nextMark)
    .setMeta('addToHistory', false)

  editor.view.dispatch(tr)
}

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
    // The <a> is in another editor; use nodePos.
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
