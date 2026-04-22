import { getMarkRange, type RawCommands } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import { createURLDecisions, type URLDecisions } from '../url-decisions'
import { logger } from '../utils/logger'
import { validateURL } from '../utils/validateURL'

type EditHyperlinkAttributes = {
  newURL?: string
  newText?: string
  title?: string
  image?: string
  markName?: string
  validate?: (url: string) => boolean
  /** URL Decisions instance; defaults to a vanilla one so manual/test callers work standalone. */
  urls?: URLDecisions
}

// Edit the hyperlink at the current selection.
//
// Returns a composable `Command` thunk so the caller's `editor.chain()`
// stays a single dispatch (a nested chain here historically produced
// "Applying a mismatched transaction" when composed with extendMarkRange).
//
// `newURL` flows through `urls.forWrite` (normalize + gate) so the edit
// surface stays in lock-step with `setHyperlink`. `validateURL` runs as
// a pre-gate shape check (historical contract: rejects `https://googlecom`
// typos before the gate sees them).
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
      urls = createURLDecisions()
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

    let href: string = currentMark.attrs.href
    if (newURL) {
      // `validate` is re-passed for defense-in-depth against a permissive `validateURL`.
      const [decision] = urls.forWrite({ kind: 'href', href: newURL }, { validate })
      if (!decision) return false
      href = decision.href
    }

    const newMark = markType.create({
      ...currentMark.attrs,
      href,
      ...(title !== undefined && { title }),
      ...(image !== undefined && { image })
    })
    tr.replaceWith(range.from, range.to, tr.doc.type.schema.text(text, [newMark]))
    return true
  }
