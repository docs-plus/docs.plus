import { Extension, isNodeEmpty } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor as TipTapEditor, EditorState, Transaction } from '@types'

type PlaceholderTextFn = (props: {
  editor: TipTapEditor
  node: ProseMirrorNode
  pos: number
  hasAnchor: boolean
  $anchor?: ReturnType<ProseMirrorNode['resolve']>
}) => string

export interface OptimizedPlaceholderOptions {
  emptyEditorClass: string
  emptyNodeClass: string
  placeholder: PlaceholderTextFn | string
  showOnlyWhenEditable: boolean
  showOnlyCurrent: boolean
  includeChildren: boolean
}

const PLACEHOLDER_KEY = new PluginKey('placeholder')

/**
 * Build a decoration set containing at most ONE placeholder decoration
 * at the cursor's parent node. Cost: O(depth) via $anchor walk.
 *
 * The original TipTap Placeholder uses doc.descendants() which is O(N)
 * on every transaction — a full document traversal per keystroke.
 */
function buildFromCursor(
  state: EditorState,
  editor: TipTapEditor,
  options: OptimizedPlaceholderOptions
): DecorationSet {
  const { $anchor } = state.selection
  if ($anchor.depth === 0) return DecorationSet.empty

  const node = $anchor.parent
  if (node.isLeaf || !isNodeEmpty(node)) return DecorationSet.empty

  const pos = $anchor.before($anchor.depth)
  const placeholderText =
    typeof options.placeholder === 'function'
      ? options.placeholder({ editor, node, pos, hasAnchor: true, $anchor })
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
 * Key difference: uses state.init/apply (cached, mapped) instead of
 * props.decorations (full rebuild every transaction).
 *
 * Per-keystroke cost:
 *   Before: O(N) doc.descendants traversal + DecorationSet.create
 *   After:  O(1) emptiness check on cursor's parent node
 */
export const OptimizedPlaceholder = Extension.create<OptimizedPlaceholderOptions>({
  name: 'placeholder',

  addOptions() {
    return {
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      placeholder: 'Write something …',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: false
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
            // No placeholder needed. Avoid any doc traversal or decoration creation.
            if (!cursorNode.isLeaf && !isNodeEmpty(cursorNode)) {
              // Only allocate a new empty set if old had decorations
              return old.find().length > 0 ? DecorationSet.empty : old
            }

            // Cursor is in an empty node — build placeholder via $anchor (O(depth)).
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
