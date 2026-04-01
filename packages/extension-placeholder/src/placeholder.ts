import type { Editor } from '@tiptap/core'
import { Extension, isNodeEmpty } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Arguments passed to the `placeholder` callback when it is a function. */
export interface PlaceholderRenderProps {
  editor: Editor
  node: ProseMirrorNode
  pos: number
  hasAnchor: boolean
  /** Parent node type name (e.g. 'doc', 'listItem', 'blockquote'). Safe during apply(). */
  parentName: string
}

export interface PlaceholderOptions {
  emptyEditorClass: string
  emptyNodeClass: string
  placeholder: ((props: PlaceholderRenderProps) => string) | string
  showOnlyWhenEditable: boolean
}

const PLACEHOLDER_KEY = new PluginKey('placeholder')

/**
 * Build a decoration set containing at most ONE placeholder decoration
 * at the cursor's parent node, plus empty-class decorations on ancestor
 * wrappers (list items, blockquotes, etc.). Cost: O(depth) via $anchor walk.
 *
 * TipTap's built-in Placeholder uses doc.descendants() — O(N) on every
 * transaction. This uses state.init/apply with cursor-only checks — O(1)
 * for the common typing case.
 */
function buildFromCursor(
  state: EditorState,
  editor: Editor,
  options: PlaceholderOptions
): DecorationSet {
  const { $anchor } = state.selection
  if ($anchor.depth === 0) return DecorationSet.empty

  const node = $anchor.parent
  if (node.isLeaf || !isNodeEmpty(node)) return DecorationSet.empty

  const pos = $anchor.before($anchor.depth)
  const parentName = $anchor.depth >= 2 ? $anchor.node($anchor.depth - 1).type.name : 'doc'
  const placeholderText =
    typeof options.placeholder === 'function'
      ? options.placeholder({ editor, node, pos, hasAnchor: true, parentName })
      : options.placeholder

  if (!placeholderText) return DecorationSet.empty

  const classes = [options.emptyNodeClass]
  if (isNodeEmpty(state.doc)) {
    classes.push(options.emptyEditorClass)
  }

  const classStr = classes.join(' ')
  const decorations: Decoration[] = [
    Decoration.node(pos, pos + node.nodeSize, {
      class: classStr,
      'data-placeholder': placeholderText
    })
  ]

  // Propagate empty class to ancestor wrappers (list items, blockquotes, etc.)
  for (let d = $anchor.depth - 1; d >= 1; d--) {
    const ancestor = $anchor.node(d)
    if (!isNodeEmpty(ancestor)) break
    const ancestorPos = $anchor.before(d)
    decorations.push(
      Decoration.node(ancestorPos, ancestorPos + ancestor.nodeSize, {
        class: classStr
      })
    )
  }

  return DecorationSet.create(state.doc, decorations)
}

/**
 * Performance-optimized Placeholder extension.
 *
 * Drop-in replacement for @tiptap/extensions Placeholder.
 * Always shows placeholder only at the current cursor node and propagates
 * empty-class to ancestor wrappers (inherently showOnlyCurrent + includeChildren).
 *
 * Per-keystroke cost:
 *   Built-in: O(N) doc.descendants traversal + DecorationSet.create
 *   This:     O(1) emptiness check on cursor's parent node
 */
export const Placeholder = Extension.create<PlaceholderOptions>({
  name: 'placeholder',

  addOptions() {
    return {
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      placeholder: 'Write something …',
      showOnlyWhenEditable: true
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options

    return [
      new Plugin({
        key: PLACEHOLDER_KEY,

        state: {
          init(_: unknown, state: EditorState): DecorationSet {
            const active = editor.isEditable || !options.showOnlyWhenEditable
            if (!active) return DecorationSet.empty
            return buildFromCursor(state, editor, options)
          },

          apply(
            _tr: Transaction,
            old: DecorationSet,
            _oldState: EditorState,
            newState: EditorState
          ): DecorationSet {
            const active = editor.isEditable || !options.showOnlyWhenEditable
            if (!active) return DecorationSet.empty

            const cursorNode = newState.selection.$anchor.parent

            // Fast path: cursor is in a non-empty node (the common typing case).
            if (!cursorNode.isLeaf && !isNodeEmpty(cursorNode)) {
              return old.find().length > 0 ? DecorationSet.empty : old
            }

            return buildFromCursor(newState, editor, options)
          }
        },

        props: {
          decorations(state: EditorState): DecorationSet {
            return this.getState(state) as DecorationSet
          }
        }
      })
    ]
  }
})
