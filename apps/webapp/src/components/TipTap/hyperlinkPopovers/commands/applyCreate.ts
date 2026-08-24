import type { CreateHyperlinkOptions } from '@docs.plus/extension-hyperlink'

import { isValidDocRange } from '../linkMarkUtils'
import type { ApplyHyperlinkArgs, ApplyHyperlinkCommandOpts, DocSelectionRange } from '../types'

type ApplyCreateOpts = CreateHyperlinkOptions & {
  selection?: DocSelectionRange
}

const chainWithOptionalFocus = (editor: CreateHyperlinkOptions['editor'], focus: boolean) =>
  focus ? editor.chain().focus() : editor.chain()

/** Every branch stamps `preventAutolink` so autolink does not re-mark this href. */
export function applyCreate(
  opts: ApplyCreateOpts,
  { href, text }: ApplyHyperlinkArgs,
  commandOpts?: ApplyHyperlinkCommandOpts
): boolean {
  if (opts.editor.isDestroyed) return false
  const focus = commandOpts?.focus !== false
  const { editor, extensionName, attributes } = opts
  const markAttrs = { ...attributes, href }
  const markType = editor.schema.marks[extensionName]
  if (!markType) return false

  const docSize = editor.state.doc.content.size
  const snap = opts.selection
  const hasSnapRange = snap != null && isValidDocRange(docSize, snap.from, snap.to)

  const rangeFrom = hasSnapRange ? snap.from : editor.state.selection.from
  const rangeTo = hasSnapRange ? snap.to : editor.state.selection.to
  const hasRange = rangeFrom < rangeTo

  if (!hasRange) {
    if (!text) return false
    if (!editor.can().setHyperlink(markAttrs)) return false
    return chainWithOptionalFocus(editor, focus)
      .insertContent({
        type: 'text',
        text,
        marks: [{ type: extensionName, attrs: markAttrs }]
      })
      .setMeta('preventAutolink', true)
      .run()
  }

  if (!editor.can().setHyperlink(markAttrs)) return false

  const selectedText = editor.state.doc.textBetween(rangeFrom, rangeTo, '\n').trim()
  const wantsReplace = Boolean(text && text.trim() !== selectedText)

  if (wantsReplace && text) {
    return chainWithOptionalFocus(editor, focus)
      .setTextSelection({ from: rangeFrom, to: rangeTo })
      .command(({ tr, state }) => {
        tr.replaceSelectionWith(state.schema.text(text, [markType.create(markAttrs)]))
        return true
      })
      .setMeta('preventAutolink', true)
      .run()
  }

  return chainWithOptionalFocus(editor, focus)
    .setTextSelection({ from: rangeFrom, to: rangeTo })
    .setHyperlink(markAttrs)
    .setMeta('preventAutolink', true)
    .run()
}
