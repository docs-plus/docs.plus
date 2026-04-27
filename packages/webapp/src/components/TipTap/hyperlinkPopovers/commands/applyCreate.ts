import type { CreateHyperlinkOptions } from '@docs.plus/extension-hyperlink'

import type { ApplyHyperlinkArgs } from '../types'

/** Apply a create result. text + empty selection → insertContent; text + selection → replaceSelectionWith; no text → setMark. Every branch stamps `preventAutolink` on the same chain so autolink doesn't re-mark our href. Closing the popover/sheet is the caller's job. */
export function applyCreate(
  opts: CreateHyperlinkOptions,
  { href, text }: ApplyHyperlinkArgs
): boolean {
  if (opts.editor.isDestroyed) return false
  const { editor, extensionName, attributes } = opts
  const markAttrs = { ...attributes, href }

  if (!editor.can().setHyperlink(markAttrs)) return false

  const chain = editor.chain().focus()

  if (text && editor.state.selection.empty) {
    chain.insertContent({
      type: 'text',
      text,
      marks: [{ type: extensionName, attrs: markAttrs }]
    })
  } else if (text) {
    chain.command(({ tr, state }) => {
      tr.replaceSelectionWith(
        state.schema.text(text, [state.schema.marks[extensionName].create(markAttrs)])
      )
      return true
    })
  } else {
    chain.setHyperlink(markAttrs)
  }

  return chain.setMeta('preventAutolink', true).run()
}
