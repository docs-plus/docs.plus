import { Node } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Custom Document node that enforces a title-first structure:
 * the document always starts with a level-1 heading, followed
 * by zero or more block nodes.
 *
 * Two plugins guard the invariant:
 *
 * 1. enforceH1Title (appendTransaction) — silently resets any
 *    heading-level change on the first node back to H1.
 *
 * 2. titlePasteHandler (handlePaste) — intercepts full-document
 *    pastes (select-all + paste) where the first pasted block is
 *    not a heading and promotes it to H1, preserving inline marks.
 */
export const TitleDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'heading block*',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('enforceH1Title'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const { firstChild } = newState.doc
          if (firstChild?.type.name === 'heading' && firstChild.attrs.level !== 1) {
            return newState.tr.setNodeMarkup(0, undefined, {
              ...firstChild.attrs,
              level: 1
            })
          }
          return null
        }
      }),

      new Plugin({
        key: new PluginKey('titlePasteHandler'),
        props: {
          handlePaste: (view, _event, slice) => {
            const { state } = view

            if (state.selection.from !== 0 || slice.openStart > 0) {
              return false
            }

            const firstNode = slice.content.firstChild
            if (!firstNode || firstNode.type.name === 'heading') {
              return false
            }

            const headingType = state.schema.nodes.heading

            const content = firstNode.isTextblock
              ? firstNode.content
              : firstNode.textContent
                ? Fragment.from(state.schema.text(firstNode.textContent))
                : Fragment.empty

            const heading = headingType.create({ level: 1 }, content)

            const newSlice = new Slice(
              Fragment.from(heading).append(slice.content.cut(firstNode.nodeSize)),
              slice.openStart,
              slice.openEnd
            )

            view.dispatch(
              state.tr
                .replaceSelection(newSlice)
                .scrollIntoView()
                .setMeta('paste', true)
                .setMeta('uiEvent', 'paste')
            )
            return true
          }
        }
      })
    ]
  }
})
