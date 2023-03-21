import { Node, mergeAttributes, findChildren, isActive } from '@tiptap/core'
import { Slice, Fragment } from 'prosemirror-model'
import { Selection, Plugin, PluginKey, TextSelection } from 'prosemirror-state'

import changeHeadingLevel from './changeHeadingLevel'
import wrapContenWithHeading from './wrapContenWithHeading'
import clipboardPast from './clipboardPast'
import changeHeading2paragraphs from './changeHeading2paragraphs'
import { getSelectionBlocks, getNodeState } from './helper'

const Blockquote = Node.create({
  name: 'heading',
  content: 'contentHeading+ contentWrapper*',
  group: 'contentWrapper',
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions () {
    return {
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      persist: false,
      openClassName: 'opend',
      id: 1,
      HTMLAttributes: {
        class: 'heading',
        level: 1
      }
    }
  },
  addAttributes () {
    return {
      level: {
        default: 1,
        rendered: false
      }
    }
  },
  addNodeView () {
    return ({ editor, getPos, node, HTMLAttributes }) => {
      const dom = document.createElement('div')
      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        level: node.firstChild?.attrs.level,
        'data-id': HTMLAttributes['data-id'] || this.options.id
      })

      const headingId = !node.attrs.id ? '1' : HTMLAttributes['data-id']

      const nodeState = getNodeState(headingId)

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value))

      dom.classList.add(nodeState.crinkleOpen ? 'opend' : 'closed')

      const content = document.createElement('div')

      content.classList.add('wrapBlock')
      content.setAttribute('data-id', headingId)
      dom.append(content)

      return {
        dom,
        contentDOM: content,
        ignoreMutation: mutation => {
          if (mutation.type === 'selection') return false

          return !dom.contains(mutation.target) || dom === mutation.target
        },
        update: updatedNode => {
          if (updatedNode.type.name !== this.name) return false

          return true
        }
      }
    }
  },
  parseHTML () {
    return [
      { tag: 'div' }
    ]
  },
  renderHTML ({ node, HTMLAttributes }) {
    // console.log(node, "coming render html")
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0]

    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands () {
    return {
      normalText: () => (arrg) => {
        return changeHeading2paragraphs(arrg)
      },
      wrapBlock: (attributes) => (arrg) => {
        const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
        const { schema, selection, doc } = state
        const { $from, $to, $anchor, $cursor } = selection

        // TODO: change heading level
        // First get the content of heading
        // then copy the contentWrapper of the heading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          return changeHeadingLevel(arrg, attributes, dispatch)
        }

        return wrapContenWithHeading(arrg, attributes, dispatch)
      }
    }
  },
  addKeyboardShortcuts () {
    return {
      Backspace: (data) => { },
      Enter: ({ editor, chain }) => {
        const { state, view } = editor
        const { schema, selection, doc, tr } = state
        const { $head, $anchor, $from, $to } = selection

        // TODO: limited just for contentHeading, contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false
        }

        const { start, end, depth } = $from.blockRange($to)

        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path.filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)

        // INFO: if the content is hide, do not anything
        // ! this open in the Heading block is wrong and Have to change, It's opposite
        const headingId = parent.attrs.id
        const nodeState = getNodeState(headingId)

        if (!nodeState.crinkleOpen) return true

        console.log('yes new', {
          $head,
          state,
          $anchor,
          parent,
          content: parent?.lastChild?.firstChild?.type.name,
          sd: Selection.near(state.doc.resolve($from.pos), 1),
          // after: $head.start(depth + 1),
          // newResolve: $head.node(depth + 1)
          isHeading: parent
        })

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        // TODO: find better way for this 4
        if (parent?.content?.content.length === 1 || parent.lastChild?.firstChild?.type.name === 'heading') {
          // console.log("yes iminininin", parent.lastChild.firstChild.contentsize === 0, parent.lastChild.firstChild)
          // If there is not any contentWrapper
          console.log(parent.lastChild)
          // if first child of the heading is another heading
          // console.log(parent.lastChild.type.name === "contentWrapper")
          // console.log(parent.lastChild.content.lastChild.type.name === "heading")
          // if the contentWrapper does not contain any content
          if (parent.lastChild.content.size === 0 || parent.lastChild?.firstChild?.content.size === 0) {
            return editor.commands.insertContentAt($anchor.pos, {
              type: 'contentWrapper',
              content: [
                {
                  type: 'paragraph'
                }
              ]

            })
          }
          console.log('move to contetnWrapper', {
            after: $anchor.after(depth + 1),
            start,
            start1: $anchor.start(depth + 2) + 1
          })
          // move to contentWrapper
          editor.commands
            .insertContentAt($anchor.start(depth + 2) + 1, '<p></p>')

          return true
        }

        // INFO: 1 mean start of the next line
        const nextLine = end + 1

        return editor.chain()
          .insertContentAt(nextLine, '<p></p>')
          .scrollIntoView()
          .run()
      }
    }
  },
  addProseMirrorPlugins () {
    return [
      // https://github.com/pageboard/pagecut/blob/bd91a17986978d560cc78642e442655f4e09ce06/src/editor.js#L234-L241
      new Plugin({
        key: new PluginKey('copy&pasteHeading'),
        props: {
          // INFO: Div turn confuses the schema service;
          // INFO:if there is a div in the clipboard, the docsplus schema will not serialize as a must.
          transformPastedHTML: (html, event) => html.replace(/div/g, 'span'),
          transformPasted: (slice) => clipboardPast(slice, this.editor),
          transformCopied: (slice, view) => {
            // Can be used to transform copied or cut content before it is serialized to the clipboard.
            const { selection, doc } = this.editor.state
            const { from, to } = selection

            // TODO: this function retrive blocks level from the selection, I need to block characters level from the selection
            const contentWrapper = getSelectionBlocks(doc.cut(from, to), null, null, true, true)

            // convert Json Block to Node Block
            let serializeSelection = contentWrapper
              .map(x => this.editor.state.schema.nodeFromJSON(x))

            // convert Node Block to Fragment
            serializeSelection = Fragment.fromArray(serializeSelection)

            // convert Fragment to Slice and save it to clipboard
            return Slice.maxOpen(serializeSelection)
          }
        }
      })
    ]
  }
})

export { Blockquote, Blockquote as default }
