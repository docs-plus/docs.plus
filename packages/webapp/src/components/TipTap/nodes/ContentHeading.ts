// TODO: Refactor this file, it's too long and hard to understand

import { mergeAttributes,Node } from '@tiptap/core'
import { DOMOutputSpec,Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TIPTAP_NODES } from '@types'

import onHeading from '../extentions/normalText/onHeading'

// Helpers
const getNodeHLevel = (doc: ProseMirrorNode, pos: number): number => {
  return doc.nodeAt(pos)!.attrs.level
}

// Tiptap Node
const HeadingsTitle = Node.create({
  name: TIPTAP_NODES.CONTENT_HEADING_TYPE,
  content: 'inline*',
  group: 'block',
  defining: true,
  isolating: true,
  // draggable: false,
  // selectable: false,
  allowGapCursor: false,
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'title'
      },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      id: null
    }
  },
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false
      },
      id: {
        default: null,
        rendered: false
      }
    }
  },
  parseHTML() {
    // Add priority to ensure proper parsing order
    return this.options.levels.map((level: number) => ({
      tag: `h${level}`,
      attrs: { level },
      priority: 50 + level // Higher priority for more specific matches
    }))
  },

  renderHTML({ node, HTMLAttributes }): DOMOutputSpec {
    const level = this.options.levels.includes(node.attrs.level)
      ? node.attrs.level
      : this.options.levels[0]

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        level,
        class: 'heading-content'
      }),
      0
    ]
  },
  addKeyboardShortcuts() {
    return {
      Backspace: (): boolean => {
        const { editor } = this
        const { schema, selection, doc } = editor.state
        const { $anchor, from, $from } = selection

        // it mean first heading node
        if (from === 2) return false

        const blockStartPos = $from.start(1) - 1
        const currentHLevel = getNodeHLevel($from.doc, blockStartPos)

        // Check if the current node is the first child of the contentWrapper
        const isFirstChild = $from.index() === 0

        // if the parent is not a content_heading node
        if ($from.parent.type.name !== TIPTAP_NODES.CONTENT_HEADING_TYPE) return false

        // if the caret is not at the beginning of the content_heading node
        if ($anchor.parentOffset !== 0) return false

        onHeading({
          backspaceAction: true,
          editor,
          state: editor.state,
          tr: editor.state.tr,
          view: editor.view
        })
        return true
      },
      Enter: () => {
        const {
          state,
          view: { dispatch }
        } = this.editor
        const { selection, doc, schema } = state
        const { $from, $to } = selection

        // Check if the caret in a content heading
        if ($from.parent.type.name !== TIPTAP_NODES.CONTENT_HEADING_TYPE) {
          return false
        }

        // Check if the caret is in the middle of the node
        if ($from.parentOffset === 0 || $from.parentOffset === $from.parent.content.size) {
          return false
        }

        // Get the content after the cursor
        const afterContent = $from.parent.cut($from.parentOffset).content

        // Create a new transaction
        const tr = state.tr

        // Delete the content after the cursor in the current node
        tr.delete($from.pos, $to.end())

        // Find the content wrapper
        const contentWrapperPos = $to.end($to.depth) + 1
        const contentWrapper = doc.nodeAt(contentWrapperPos)

        if (contentWrapper && contentWrapper.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
          // Save the first child of the content wrapper
          const firstChild = contentWrapper.firstChild
          let savedContent = firstChild ? firstChild.content : null

          if (firstChild) {
            tr.delete(
              tr.mapping.map(contentWrapperPos + 1),
              tr.mapping.map(contentWrapperPos + 1 + firstChild.nodeSize)
            )
          }

          // Create a new paragraph with the saved content
          const newParagraph = schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create(null, afterContent)
          savedContent = savedContent
            ? newParagraph.content.append(savedContent)
            : newParagraph.content

          const newNode = schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create(null, savedContent)

          // Insert the new node at the beginning of the content wrapper
          tr.insert(tr.mapping.map(contentWrapperPos + 1), newNode)

          // Dispatch the transaction
          dispatch(tr)
          return true
        }

        return false
      }
    }
  }
})

export { HeadingsTitle as default,HeadingsTitle }
