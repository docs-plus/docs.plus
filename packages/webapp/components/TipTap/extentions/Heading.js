import { Node, mergeAttributes, InputRule, callOrReturn } from '@tiptap/core'
import { Slice, Fragment } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import changeHeadingLevel from './changeHeadingLevel.js'
import wrapContenWithHeading from './wrapContenWithHeading.js'
import clipboardPast from './clipboardPast.js'
import changeHeading2paragraphs from './changeHeading2paragraphs.js'
import { getSelectionBlocks, getNodeState } from './helper.js'
import deleteSelectedRange from './deleteSelectedRange.js'
import ENUMS from '../enums.js'

const Heading = Node.create({
  name: ENUMS.NODES.HEADING_TYPE,
  content: 'contentHeading contentWrapper',
  group: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      persist: false,
      id: 1,
      HTMLAttributes: {
        class: ENUMS.NODES.HEADING_TYPE,
        level: 1
      }
    }
  },
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false
      }
    }
  },

  addNodeView() {
    return ({ getPos, node, HTMLAttributes }) => {
      const dom = document.createElement('div')

      const headingId = node.attrs.id || ''

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        level: node.firstChild?.attrs.level,
        'data-id': headingId
      })

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
        ignoreMutation: (mutation) => {
          if (mutation.type === 'selection') return false

          return !dom.contains(mutation.target) || dom === mutation.target
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false

          // Update the level attribute when it changes
          const newLevel = updatedNode.firstChild?.attrs.level
          if (newLevel && dom.getAttribute('level') !== newLevel.toString()) {
            dom.setAttribute('level', newLevel)
          }

          const prevHeadingId = dom.getAttribute('data-id')
          const newHeadingId = updatedNode.attrs.id

          // TODO: this is temporary solution, need to find better way for this
          if (!prevHeadingId.length && newHeadingId) {
            dom.setAttribute('data-id', newHeadingId)
            content.setAttribute('data-id', newHeadingId)

            // Update the node's ID
            if (this.editor && this.editor.state) {
              const { tr } = this.editor.state
              const pos = getPos()
              if (pos !== undefined) {
                tr.setNodeMarkup(pos, null, { ...updatedNode.attrs, id: newHeadingId })
                this.editor.view.dispatch(tr)
              }
            }
          }

          return true
        }
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      normalText: () => (arrg) => {
        return changeHeading2paragraphs(arrg)
      },
      wrapBlock: (attributes) => (arrg) => {
        const { dispatch, state } = arrg
        const { selection } = state
        const { $anchor } = selection

        // if cursor is on the heading block, change the level of the heading
        if ($anchor.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
          return changeHeadingLevel(arrg, attributes, dispatch)
        }

        return wrapContenWithHeading(arrg, attributes)
      },
      ensureContentWrapper:
        () =>
        ({ tr, state, dispatch }) => {
          const { doc, schema } = state
          doc.descendants((node, pos) => {
            if (node.type.name === ENUMS.NODES.HEADING_TYPE && !node.childCount) {
              const contentWrapper = schema.nodes.contentWrapper.create()
              tr.insert(pos + node.nodeSize, contentWrapper)
            }
          })
          if (dispatch) dispatch(tr)
          return true
        }
    }
  },
  addKeyboardShortcuts() {
    return {
      Delete: () => {
        const { $anchor, $head } = this.editor.state.selection
        // we need detect the selection
        if ($anchor?.pos === $head?.pos) return false

        console.info('[Heading] Delete key pressed')

        // Check if selection covers entire document content
        // Due to document schema hierarchy, content starts at position 2 and ends at docSize - 3
        const docSize = this.editor.state.doc.content.size
        const isEntireDocument = $anchor.pos === 2 && $head.pos === docSize - 3
        if (isEntireDocument) return false

        // if user select a range of content, then hit any key, remove the selected content
        return deleteSelectedRange(this.editor)
      },
      // TODO: Refactor from scratch to make it more readable and improve the performance
      Enter: ({ editor }) => {
        const { state } = editor
        const { schema, selection } = state
        const { $head, $anchor, $from, $to } = selection

        // TODO: limited just for contentHeading, contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false
        }

        const { end, depth } = $from.blockRange($to)

        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path
          .filter((x) => x?.type?.name)
          .findLast((x) => x.type.name === this.name)

        // INFO: if the content is hide, do not anything
        // ! this open in the Heading block is wrong and Have to change, It's opposite
        const headingId = parent.attrs.id
        const nodeState = getNodeState(headingId)

        if (!nodeState.crinkleOpen) return true

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        // TODO: find better way for this 4
        if (
          parent?.content?.content.length === 1 ||
          parent.lastChild?.firstChild?.type.name === ENUMS.NODES.HEADING_TYPE
        ) {
          // If there is not any contentWrapper
          // if first child of the heading is another heading
          // console.log(parent.lastChild.type.name === "contentWrapper")
          // console.log(parent.lastChild.content.lastChild.type.name === "heading")
          // if the contentWrapper does not contain any content
          if (
            parent.lastChild.content.size === 0 ||
            parent.lastChild?.firstChild?.content.size === 0
          ) {
            return editor.commands.insertContentAt($anchor.pos, {
              type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
              content: [
                {
                  type: ENUMS.NODES.PARAGRAPH_TYPE
                }
              ]
            })
          }

          // move to contentWrapper
          editor.commands.insertContentAt($anchor.start(depth + 2) + 1, '<p></p>')

          return true
        }

        // INFO: 1 mean start of the next line
        const nextLine = end + 1

        return editor.chain().insertContentAt(nextLine, '<p></p>').scrollIntoView().run()
      },
      ...this.options.levels.reduce(
        (items, level) => ({
          ...items,
          ...{
            [`Mod-Alt-${level}`]: () =>
              this.editor.commands.wrapBlock({
                level: level
              })
          }
        }),
        {}
      ),
      // Add shortcut for normal text (level 0)
      'Mod-Alt-0': () => this.editor.commands.normalText()
    }
  },
  addInputRules() {
    return this.options.levels.map((level) => {
      const config = {
        find: new RegExp(`^(#{${Math.min(...this.options.levels)},${level}})\\s$`),
        type: this.type,
        getAttributes: {
          level
        }
      }
      return new InputRule({
        find: config.find,
        handler: (data) => {
          const { state, range, match } = data
          const $start = state.doc.resolve(range.from)
          const attributes = callOrReturn(config.getAttributes, undefined, match) || {}

          state.tr.delete(range.from, range.to)
          return wrapContenWithHeading({ ...data, tr: state.tr }, attributes)
        }
      })
    })
  },
  addProseMirrorPlugins() {
    let domeEvent
    return [
      // new Plugin({
      //   key: new PluginKey('ensureContentWrapperPlugin'),
      //   appendTransaction: (transactions, oldState, newState) => {
      //     console.log('ensureContentWrapperPlugin running, doc size:', newState.doc.nodeSize)
      //     let tr = newState.tr
      //     let modified = false

      //     newState.doc.descendants((node, pos) => {
      //       if (node.type.name === ENUMS.NODES.HEADING_TYPE && !node.childCount) {
      //         console.log('Empty heading found at pos:', pos, 'Adding contentWrapper')
      //         const contentWrapper = newState.schema.nodes.contentWrapper.create()
      //         tr = tr.insert(pos + node.nodeSize, contentWrapper)
      //         modified = true
      //       }
      //     })

      //     return modified ? tr : null
      //   }
      // }),
      // https://github.com/pageboard/pagecut/blob/bd91a17986978d560cc78642e442655f4e09ce06/src/editor.js#L234-L241
      new Plugin({
        key: new PluginKey('copy&pasteHeading'),
        props: {
          handleDOMEvents: {
            cut: () => {
              domeEvent = 'cut'
              return false
            },
            copy: () => {
              domeEvent = 'copy'
            }
          },
          // INFO: Div turn confuses the schema service;
          // INFO: if there is a div in the clipboard, the docsplus schema will not serialize as a must.
          transformPastedHTML: (html) => html.replace(/div/g, 'span'),
          transformPasted: (slice) => clipboardPast(slice, this.editor),
          transformCopied: () => {
            const { editor } = this
            // Can be used to transform copied or cut content before it is serialized to the clipboard.
            const { selection, doc } = this.editor.state
            const { from, to } = selection

            // TODO: this function retrive blocks level from the selection, I need to block characters level from the selection
            const contentWrapper = getSelectionBlocks(doc.cut(from, to), null, null, true, true)

            if (domeEvent === 'cut') {
              // remove selection from the editor
              deleteSelectedRange(editor)
            }

            // convert Json Block to Node Block
            let serializeSelection = contentWrapper.map((x) =>
              this.editor.state.schema.nodeFromJSON(x)
            )

            // convert Node Block to Fragment
            serializeSelection = Fragment.fromArray(serializeSelection)

            // convert Fragment to Slice and save it to clipboard
            return Slice.maxOpen(serializeSelection)
          }
        }
      }),
      new Plugin({
        key: new PluginKey('handleRangeSelection'),
        props: {
          handleTextInput: () => {
            const { $anchor, $head } = this.editor.state.selection

            // we need detect the selection
            if ($anchor?.pos === $head?.pos) return false

            const isAnchorInContentHeading =
              $anchor.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE
            const isHeadInContentHeading =
              $head.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE

            // TODO: Handle this case later
            // if the $ancher parent is contentheading then return false
            if (isAnchorInContentHeading) {
              console.info(
                '[Heading][RangeSelection]: contentHeading detected, we do not need to handle this'
              )
              // if both $anchor and $head parents are content headings, do nothing
              return isHeadInContentHeading ? false : true
            }

            console.info('[Heading] Range selection delete')
            // if user select a range of content, then hit any key, remove the selected content
            return deleteSelectedRange(this.editor)
          }
        }
      })
    ]
  }
})

export { Heading, Heading as default }
