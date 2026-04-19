import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

/**
 * Defense-in-depth: only allow http(s) image sources. `<img src="javascript:…">`
 * is inert in modern browsers, but `data:` URIs can carry SVG with embedded
 * scripts in some attack contexts and are also a tracking-pixel vector when
 * the source is third-party JSON we don't fully control (oEmbed thumbnails,
 * scraped meta tags). Returns `undefined` for anything that isn't plain
 * http(s) so the caller falls through to the next image candidate.
 */
export const safeImageSrc = (url: string | undefined): string | undefined => {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}

/**
 * Minimal shape required to write metadata back onto the hyperlink mark.
 * Both the desktop popover (`MetadataResponse`) and the React mobile sheet
 * (narrowed `LinkMetadata`) satisfy it without further conversion.
 */
export interface MarkMetadata {
  title: string
  image?: { url: string } | undefined
}

/**
 * Guarded mark-attr write that updates the hyperlink's `title`/`image`
 * attrs without touching the editor selection.
 *
 * Timing rule:
 *   - **Desktop floating popover:** MUST defer until after the popover
 *     detaches. Changing mark attrs causes ProseMirror to re-render the
 *     underlying `<a>` element; the floating-toolbar pins to that `<a>`
 *     via `referenceElement`, and floating-ui's
 *     `hide({ strategy: 'referenceHidden' })` middleware detects the
 *     now-detached reference and hides the popover. Use the `flush`
 *     handle returned by `renderMetadataInto` for this.
 *   - **Mobile bottom sheet (React):** Safe to call immediately on
 *     metadata arrival — the sheet is fixed at the viewport bottom and
 *     isn't anchored to the link DOM, so a mark-attr re-render doesn't
 *     affect it.
 *
 * Implementation notes:
 *   - resolves the hyperlink mark range around `nodePos` via
 *     `getMarkRange` (filtered by `href` so adjacent unrelated links are
 *     never touched),
 *   - replaces the mark with one carrying the new `title`/`image` while
 *     preserving every other attr,
 *   - bails out on no-op writes (same title + image) so we never
 *     dispatch an empty transaction,
 *   - tags the tr `addToHistory: false` (background metadata is not an
 *     undoable user action).
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
  const tr = state.tr
    .removeMark(range.from, range.to, hyperlinkType)
    .addMark(range.from, range.to, nextMark)
    .setMeta('addToHistory', false)

  editor.view.dispatch(tr)
}
