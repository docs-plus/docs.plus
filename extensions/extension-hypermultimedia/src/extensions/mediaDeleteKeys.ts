import { Extension, isiOS, isMacOS } from '@tiptap/core'
import { GapCursor } from '@tiptap/pm/gapcursor'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { type Command, NodeSelection, TextSelection } from '@tiptap/pm/state'

export interface MediaDeleteKeysOptions {
  mediaNodes: string[]
}

// Runs ahead of joinBackward / joinForward: those delete an atom in one press,
// and no single press may delete media (#376). The first press next to media selects it.
export const MediaDeleteKeys = Extension.create<MediaDeleteKeysOptions>({
  name: 'MediaDeleteKeys',
  priority: 101,

  addOptions() {
    return {
      mediaNodes: []
    }
  },

  addKeyboardShortcuts() {
    const { mediaNodes } = this.options

    const isMedia = (node: ProseMirrorNode | null | undefined) =>
      !!node && mediaNodes.includes(node.type.name)

    const select =
      (pos: number): Command =>
      (state, dispatch) => {
        dispatch?.(state.tr.setSelection(NodeSelection.create(state.doc, pos)).scrollIntoView())
        return true
      }

    // Removes the empty line and leaves a gap cursor after the media.
    // `skipTrailingNode` is the TrailingNode meta: without it, a removed last line
    // comes back in the same dispatch and the caret falls into it.
    // Before a text block this cursor fails GapCursor.valid on purpose; a later mapped step moves it.
    const removeLine =
      (from: number, to: number, gapPos: number): Command =>
      (state, dispatch) => {
        if (dispatch) {
          const tr = state.tr.delete(from, to)
          tr.setSelection(new GapCursor(tr.doc.resolve(gapPos)))
          dispatch(tr.setMeta('skipTrailingNode', true).scrollIntoView())
        }
        return true
      }

    const backward: Command = (state, dispatch) => {
      const { selection } = state
      if (!selection.empty) return false
      const { $from } = selection
      const before = $from.nodeBefore
      if (before && isMedia(before)) return select($from.pos - before.nodeSize)(state, dispatch)

      if (!(selection instanceof TextSelection) || $from.parentOffset !== 0) return false
      const index = $from.index($from.depth - 1)
      if (index === 0) return false
      const sibling = $from.node($from.depth - 1).child(index - 1)
      if (!isMedia(sibling)) return false

      if ($from.parent.content.size === 0) {
        return removeLine($from.before(), $from.after(), $from.before())(state, dispatch)
      }
      return select($from.before() - sibling.nodeSize)(state, dispatch)
    }

    const forward: Command = (state, dispatch) => {
      const { selection } = state
      if (!selection.empty) return false
      const { $from } = selection
      const after = $from.nodeAfter
      if (isMedia(after)) return select($from.pos)(state, dispatch)

      if (!(selection instanceof TextSelection)) {
        const emptyLine = after?.isTextblock && after.content.size === 0
        if (!emptyLine || !isMedia($from.nodeBefore)) return false
        return removeLine($from.pos, $from.pos + after.nodeSize, $from.pos)(state, dispatch)
      }

      const { parent } = $from
      // Empty line: core deleteCurrentNode removes it. The caret then selects block media,
      // or sits before the inline image. Neither case deletes media in one press.
      if (parent.content.size === 0) return false
      if ($from.parentOffset !== parent.content.size) return false
      const container = $from.node($from.depth - 1)
      const index = $from.index($from.depth - 1)
      if (index + 1 >= container.childCount || !isMedia(container.child(index + 1))) return false
      return select($from.after())(state, dispatch)
    }

    // Skip commands.command: it dispatches an empty transaction even when the command returns false.
    const run = (command: Command) => () => command(this.editor.state, this.editor.view.dispatch)
    const handleBackspace = run(backward)
    const handleDelete = run(forward)

    // Same keys that @tiptap/core src/extensions/keymap.ts sends to its Backspace and Delete handlers.
    const shortcuts: Record<string, () => boolean> = {
      Backspace: handleBackspace,
      'Mod-Backspace': handleBackspace,
      'Shift-Backspace': handleBackspace,
      Delete: handleDelete,
      'Mod-Delete': handleDelete
    }
    if (isiOS() || isMacOS()) {
      Object.assign(shortcuts, {
        'Ctrl-h': handleBackspace,
        'Alt-Backspace': handleBackspace,
        'Ctrl-d': handleDelete,
        'Ctrl-Alt-Backspace': handleDelete,
        'Alt-Delete': handleDelete,
        'Alt-d': handleDelete
      })
    }
    return shortcuts
  }
})
