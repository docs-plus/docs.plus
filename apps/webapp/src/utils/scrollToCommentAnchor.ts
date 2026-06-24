import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import type { CommentAnchorV1, MediaCommentAnchor, TextCommentAnchor } from '@types'

import { scrollElementInMobilePadEditor } from './scrollMobilePadEditor'
import { scrollToHeading } from './scrollToHeading'

const scrollElementIntoEditorView = (el: HTMLElement): void => {
  // Mobile pad scroller only supports start/nearest; desktop centers the target.
  if (!scrollElementInMobilePadEditor(el, { behavior: 'smooth', block: 'start' })) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
}

const elementFromDom = (dom: Node | null): HTMLElement | null =>
  dom instanceof HTMLElement ? dom : (dom?.parentElement ?? null)

/** Scroll to (and ring-select) the exact media node the comment is anchored to. */
const focusMediaAnchor = (editor: Editor, anchor: MediaCommentAnchor): boolean => {
  if (!anchor.src) return false

  let nodePos: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (nodePos != null) return false
    if (
      node.type.name === anchor.node_type &&
      (node.attrs as { src?: string }).src === anchor.src
    ) {
      nodePos = pos
      return false
    }
    return true
  })
  if (nodePos == null) return false

  // PM-managed NodeSelection renders the selection ring without a foreign DOM
  // mutation (which would recreate the media node view) and without focusing the
  // editor (which would pop the iOS keyboard).
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, nodePos))
    )
  } catch {
    // Node not selectable — fall through to plain scroll.
  }

  const el = elementFromDom(editor.view.nodeDOM(nodePos))
  if (el) scrollElementIntoEditorView(el)
  return true
}

/** Scroll to the block holding the commented text run. */
const focusTextAnchor = (editor: Editor, anchor: TextCommentAnchor): boolean => {
  const needle = anchor.content.trim()
  if (!needle) return false

  let from: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (from != null) return false
    if (node.isText && node.text) {
      const idx = node.text.indexOf(needle)
      if (idx >= 0) {
        from = pos + idx
        return false
      }
    }
    return true
  })
  if (from == null) return false

  const el = elementFromDom(editor.view.domAtPos(from).node)
  if (!el) return false
  scrollElementIntoEditorView(el)
  return true
}

/**
 * Jump the document to the exact content a chat comment is anchored to — the media
 * node or text run, not just the section heading. Falls back to the heading when the
 * editor isn't mounted or the target can't be resolved.
 */
export const scrollToCommentAnchor = (anchor: CommentAnchorV1): void => {
  const editor = useStore.getState().settings.editor.instance
  if (editor) {
    const focused =
      anchor.kind === 'media' ? focusMediaAnchor(editor, anchor) : focusTextAnchor(editor, anchor)
    if (focused) return
  }
  scrollToHeading(anchor.heading_id)
}
