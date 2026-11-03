import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

import { getLinkContext } from '../interactions/openLink'
import { buildPreviewOptionsFromAnchor } from './buildPreviewOptionsFromAnchor'
import { focusPreviewFromKeyboard } from './focusPreviewFromKeyboard'
import { linkAtSelection } from './linkAtSelection'
import { openPreviewHyperlink } from './openPreviewHyperlink'

function anchorAt(view: EditorView, pos: number): HTMLAnchorElement | null {
  const { node, offset } = view.domAtPos(pos)
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement?.closest('a') ?? null
  const element = node as Element
  const child = element.childNodes[offset]
  if (child instanceof Element) return child.closest('a')
  return element.closest('a')
}

/**
 * Mod-K with the caret strictly inside a link opens that link's preview.
 * Returns `true` whenever a link is found, even when the host opts out,
 * so the create form never opens over an existing link.
 */
export const openPreviewAtSelection = (editor: Editor): boolean => {
  const ctx = getLinkContext(editor)
  if (!ctx) return false
  const range = linkAtSelection(editor.state, ctx.type)
  if (!range) return false
  // No preview slot is the host opt-out; the opener would fall back to the prebuilt preview.
  if (!ctx.previewPopover) return true

  const link = anchorAt(editor.view, range.from + 1)
  if (!link) return true
  const opts = buildPreviewOptionsFromAnchor({
    editor,
    link,
    nodePos: range.from,
    validate: ctx.validate,
    isAllowedUri: (uri: string) => ctx.urls.forRead(uri).navigable
  })
  if (!openPreviewHyperlink(opts)) return true

  // `view.focus()` is synchronous and puts back the same caret. Tiptap's `focus` waits a frame.
  focusPreviewFromKeyboard(() => {
    if (!editor.isDestroyed) editor.view.focus()
  })
  return true
}
