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
  /** Doc that `pos` resolves against. Use this — `editor.state.doc` is stale during apply(). */
  doc: ProseMirrorNode
}

export interface PlaceholderOptions {
  emptyEditorClass: string
  emptyNodeClass: string
  placeholder: ((props: PlaceholderRenderProps) => string) | string
  showOnlyWhenEditable: boolean
}

const PLACEHOLDER_KEY = new PluginKey('placeholder')

/**
 * At most one placeholder decoration at the cursor's empty parent, plus
 * empty-class decorations on empty ancestor wrappers. Cost: O(depth).
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
  const parentName = $anchor.node($anchor.depth - 1).type.name
  const placeholderText =
    typeof options.placeholder === 'function'
      ? options.placeholder({ editor, node, pos, hasAnchor: true, parentName, doc: state.doc })
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
 * Drop-in replacement for the built-in Placeholder with O(depth) cursor-based
 * state init/apply instead of the built-in's O(N) doc.descendants scan.
 * Decorates the empty node at the cursor plus empty ancestor wrappers —
 * inherently showOnlyCurrent + includeChildren.
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
            return buildFromCursor(state, editor, options)
          },

          apply(
            tr: Transaction,
            old: DecorationSet,
            _oldState: EditorState,
            newState: EditorState
          ): DecorationSet {
            // Decorations derive solely from doc + selection, so meta-only
            // transactions (collab pings, plugin meta) cannot change them.
            if (!tr.docChanged && !tr.selectionSet) return old

            const cursorNode = newState.selection.$anchor.parent

            // Fast path: cursor is in a non-empty node (the common typing case).
            // Returning the singleton keeps identity when old was already empty.
            if (!cursorNode.isLeaf && !isNodeEmpty(cursorNode)) {
              return DecorationSet.empty
            }

            return buildFromCursor(newState, editor, options)
          }
        },

        props: {
          // Gate editability here, not in apply: setEditable() refreshes props via
          // view.updateState without dispatching a transaction, so the placeholder
          // toggles immediately when the editor flips to/from read-only.
          decorations(state: EditorState): DecorationSet | null {
            if (options.showOnlyWhenEditable && !editor.isEditable) return null
            return this.getState(state) ?? null
          }
        }
      })
    ]
  }
})
