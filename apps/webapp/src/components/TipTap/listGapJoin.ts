import { Extension, isiOS, isList, isMacOS } from '@tiptap/core'
import { autoJoin } from '@tiptap/pm/commands'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { type Command, Selection } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

type Direction = -1 | 1

const isEmptyParagraph = (node: PMNode | null | undefined): node is PMNode =>
  node?.type.name === TIPTAP_NODES.PARAGRAPH_TYPE && node.content.size === 0

// Mirrors the private areListTypesCompatible in @tiptap/core src/commands/toggleList.ts.
const normalizeListType = (type: unknown) => (!type || type === '1' ? null : type)

/**
 * Backspace or Delete removes an empty paragraph between two lists and joins
 * matching lists in one step. Temporary until upstream ListKeymap re-joins
 * lists across an empty paragraph. Priority 101 runs it before ListKeymap.
 */
export const ListGapJoin = Extension.create({
  name: 'listGapJoin',
  priority: 101,

  addKeyboardShortcuts() {
    const isListNode = (node: PMNode | null | undefined): node is PMNode =>
      !!node && isList(node.type.name, this.editor.extensionManager.extensions)

    const isCompatibleList = (a: PMNode, b: PMNode) =>
      a.type === b.type &&
      isListNode(a) &&
      normalizeListType(a.attrs.type) === normalizeListType(b.attrs.type)

    const gapAfterListEnd = ($from: ResolvedPos) => {
      if (!$from.parent.isTextblock || $from.pos !== $from.end()) return null
      for (let depth = $from.depth - 1; depth >= 0; depth--) {
        const after = $from.after(depth + 1)
        // Only closing tokens so far: this node is the last child of its parent.
        if (after === $from.end(depth)) continue
        const gap = $from.doc.nodeAt(after)
        if (!isListNode($from.node(depth + 1)) || !isEmptyParagraph(gap)) return null
        return { start: after, end: after + gap.nodeSize, inGap: false }
      }
      return null
    }

    const findGap = ($from: ResolvedPos, dir: Direction) => {
      const { doc } = $from
      if (isEmptyParagraph($from.parent)) {
        const start = $from.before()
        const end = $from.after()
        const betweenLists =
          isListNode(doc.resolve(start).nodeBefore) && isListNode(doc.resolve(end).nodeAfter)
        if (betweenLists) return { start, end, inGap: true }
      }
      return dir > 0 ? gapAfterListEnd($from) : null
    }

    const deleteListGap =
      (dir: Direction): Command =>
      (state, dispatch) => {
        if (!state.selection.empty) return false
        const gap = findGap(state.selection.$from, dir)
        if (!gap) return false
        if (dispatch) {
          const tr = state.tr.delete(gap.start, gap.end)
          if (gap.inGap) tr.setSelection(Selection.near(tr.doc.resolve(gap.start), dir))
          dispatch(tr.scrollIntoView())
        }
        return true
      }

    // autoJoin joins the lists that end up adjacent after the delete. Skip commands.command:
    // it dispatches an empty transaction even when the command returns false.
    const run = (dir: Direction) => () =>
      autoJoin(deleteListGap(dir), isCompatibleList)(this.editor.state, this.editor.view.dispatch)
    const backward = run(-1)
    const forward = run(1)

    // Same keys that @tiptap/core src/extensions/keymap.ts sends to its Backspace and Delete handlers.
    const shortcuts: Record<string, () => boolean> = {
      Backspace: backward,
      'Mod-Backspace': backward,
      'Shift-Backspace': backward,
      Delete: forward,
      'Mod-Delete': forward
    }
    if (isiOS() || isMacOS()) {
      Object.assign(shortcuts, {
        'Ctrl-h': backward,
        'Alt-Backspace': backward,
        'Ctrl-d': forward,
        'Ctrl-Alt-Backspace': forward,
        'Alt-Delete': forward,
        'Alt-d': forward
      })
    }
    return shortcuts
  }
})
