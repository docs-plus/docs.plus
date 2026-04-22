import { getMarkRange, type RawCommands } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import { logger } from '../utils/logger'
import { DEFAULT_PROTOCOL, normalizeHref } from '../utils/normalizeHref'
import { isSafeHref, validateURL } from '../utils/validateURL'

type EditHyperlinkAttributes = {
  newURL?: string
  newText?: string
  title?: string
  image?: string
  markName?: string
  validate?: (url: string) => boolean
  /** Bare-domain promotion target (defaults to `https`). */
  defaultProtocol?: string
  /** Composed XSS + `isAllowedUri` gate (defaults to plain `isSafeHref`). */
  isAllowedUri?: (uri: string) => boolean
}

/**
 * Edit the hyperlink at the current selection.
 *
 * Returns a composable Tiptap command so the caller's `editor.chain()` stays
 * a single dispatch — a previous footgun dispatched a nested chain inside
 * here and produced "Applying a mismatched transaction" when composed with
 * commands like `extendMarkRange`.
 *
 * All position + mark lookups happen against `tr.doc` inside the command,
 * never a state snapshot captured before the chain started.
 *
 * `newURL` is run through `normalizeHref` before writing, so bare domains
 * (`google.com`) become `https://google.com` — matching every other
 * write-boundary (create popover, `setHyperlink`, autolink, paste).
 */
export const editHyperlinkCommand =
  (attributes: EditHyperlinkAttributes = {}): RawCommands['editHyperlink'] =>
  () =>
  ({ tr, dispatch }) => {
    const {
      newURL,
      newText,
      title,
      image,
      validate,
      markName = HYPERLINK_MARK_NAME,
      defaultProtocol = DEFAULT_PROTOCOL,
      isAllowedUri = isSafeHref
    } = attributes

    if (newURL && !validateURL(newURL, { customValidator: validate })) {
      return false
    }

    const markType = tr.doc.type.schema.marks[markName]
    if (!markType) return false

    const { from } = tr.selection
    const $pos = tr.doc.resolve(from)
    const range = getMarkRange($pos, markType)
    if (!range) return false

    let currentMark
    try {
      currentMark = tr.doc.nodeAt(range.from)?.marks.find((m) => m.type === markType)
    } catch (error) {
      logger.warn('editHyperlink: failed to read mark at position', error)
      return false
    }
    if (!currentMark) return false

    if (!dispatch) return true

    const text = newText || tr.doc.textBetween(range.from, range.to)
    const href = newURL ? normalizeHref(newURL, defaultProtocol) : currentMark.attrs.href

    // Defense-in-depth: even with `validateURL` upstream, a custom
    // `validate` override could be permissive. Re-run the composed
    // XSS + `isAllowedUri` gate at the actual write site.
    if (newURL && !isAllowedUri(href)) return false

    const newMark = markType.create({
      ...currentMark.attrs,
      href,
      ...(title !== undefined && { title }),
      ...(image !== undefined && { image })
    })
    tr.replaceWith(range.from, range.to, tr.doc.type.schema.text(text, [newMark]))
    return true
  }
