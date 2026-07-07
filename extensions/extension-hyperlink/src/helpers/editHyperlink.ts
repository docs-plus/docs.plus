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

// Returns a composable `Command` thunk: a nested chain here historically
// produced "Applying a mismatched transaction" under `extendMarkRange`.
// `newURL` flows through `urls.forWrite` (normalize + gate) so the edit
// surface stays in lock-step with `setHyperlink`.
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

    const currentText = tr.doc.textBetween(range.from, range.to)
    const text = newText || currentText

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

    // Unchanged text: swap only the hyperlink mark in place so co-located
    // marks (bold/italic/code) survive the edit untouched.
    if (text === currentText) {
      tr.removeMark(range.from, range.to, markType)
      tr.addMark(range.from, range.to, newMark)
      return true
    }

    // Text changed: the range is rebuilt, so carry the first text node's
    // non-hyperlink marks onto the replacement.
    const carried = tr.doc.nodeAt(range.from)?.marks.filter((mark) => mark.type !== markType) ?? []
    tr.replaceWith(range.from, range.to, tr.doc.type.schema.text(text, [...carried, newMark]))
    return true
  }
