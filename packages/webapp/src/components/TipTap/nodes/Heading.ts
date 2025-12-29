import { Node, mergeAttributes, InputRule, callOrReturn } from '@tiptap/core'
import changeHeadingLevel from '../extentions/changeHeadingLevel'
import wrapContenWithHeading from '../extentions/wrapContenWithHeading'
import changeHeading2paragraphs from '../extentions/changeHeading2paragraphs'
import deleteSelectedRange from '../extentions/deleteSelectedRange'
import {
  TIPTAP_NODES,
  type ProseMirrorNode,
  type CommandProps,
  type DOMOutputSpec,
  type ViewMutationRecord
} from '@types'
import { getNodeState } from '../extentions/helper'
import {
  createCopyPastePlugin,
  createRangeSelectionPlugin,
  createHierarchyValidationPlugin
} from '../extentions/plugins'
import { HeadingAttributes } from '../extentions/types'

const Heading = Node.create({
  name: TIPTAP_NODES.HEADING_TYPE,
  content: 'contentHeading contentWrapper',
  group: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      persist: false,
      id: 1,
      HTMLAttributes: {
        class: TIPTAP_NODES.HEADING_TYPE,
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

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value as string))

      dom.classList.add(nodeState.crinkleOpen ? 'opend' : 'closed')

      const content = document.createElement('div')

      content.classList.add('wrapBlock')
      content.setAttribute('data-id', headingId)
      dom.append(content)

      return {
        dom,
        contentDOM: content,
        ignoreMutation: (mutation: ViewMutationRecord) => {
          if (mutation.type === 'selection') return false

          return !dom.contains(mutation.target as globalThis.Node) || dom === mutation.target
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false

          // Update the level attribute when it changes
          const newLevel = updatedNode.firstChild?.attrs.level
          if (newLevel && dom.getAttribute('level') !== newLevel.toString()) {
            dom.setAttribute('level', newLevel)
          }

          const prevHeadingId = dom.getAttribute('data-id') || ''
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
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      normalText:
        () =>
        ({ state, tr, dispatch, editor }: CommandProps) => {
          changeHeading2paragraphs({ state, tr, dispatch, editor })
          return true
        },
      wrapBlock:
        (attributes: HeadingAttributes) =>
        ({ state, tr, dispatch, editor }: CommandProps) => {
          const { selection } = state
          const { $anchor } = selection

          // if cursor is on the heading block, change the level of the heading
          if ($anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
            changeHeadingLevel({ state, tr, dispatch, editor }, attributes)
            return true
          }

          wrapContenWithHeading({ state, tr, dispatch, editor }, attributes)
          return true
        },
      ensureContentWrapper:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { doc, schema } = state
          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.type.name === TIPTAP_NODES.HEADING_TYPE && !node.childCount) {
              const contentWrapper = schema.nodes.contentWrapper.create()
              tr.insert(pos + node.nodeSize, contentWrapper)
            }
          })
          if (dispatch) dispatch(tr)
          return true
        }
    } as any // Custom commands - proper declaration requires extending TipTap's RawCommands
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

        const { end, depth } = $from.blockRange($to)!

        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = ($head as any).path
          .filter((x: any) => x?.type?.name)
          .findLast((x: any) => x.type.name === this.name)

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
          parent.lastChild?.firstChild?.type.name === TIPTAP_NODES.HEADING_TYPE
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
              type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
              content: [
                {
                  type: TIPTAP_NODES.PARAGRAPH_TYPE
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
        (items: any, level: number) => ({
          ...items,
          ...{
            [`Mod-Alt-${level}`]: () =>
              (this.editor.commands as any).wrapBlock({
                level: level
              })
          }
        }),
        {}
      ),
      // Add shortcut for normal text (level 0)
      'Mod-Alt-0': () => (this.editor.commands as any).normalText()
    }
  },
  addInputRules() {
    return this.options.levels.map((level: number) => {
      const config = {
        find: new RegExp(`^(#{${Math.min(...this.options.levels)},${level}})\\s$`, 'g'),
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
          wrapContenWithHeading(
            { ...data, tr: state.tr, editor: this.editor },
            attributes as HeadingAttributes
          )
        }
      })
    })
  },
  addProseMirrorPlugins() {
    return [
      createCopyPastePlugin(this.editor),
      createRangeSelectionPlugin(this.editor),
      createHierarchyValidationPlugin()
    ]
  }
})

export { Heading, Heading as default }
