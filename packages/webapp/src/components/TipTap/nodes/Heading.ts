import { callOrReturn, InputRule, mergeAttributes, Node } from '@tiptap/core'
import {
  type CommandProps,
  type DOMOutputSpec,
  type ProseMirrorNode,
  type ResolvedPos,
  TIPTAP_NODES,
  type ViewMutationRecord
} from '@types'

import changeHeadingLevel from '../extentions/changeHeadingLevel'
import changeHeadingToParagraphs from '../extentions/changeHeadingToParagraphs'
import deleteSelectedRange from '../extentions/deleteSelectedRange'
import { getNodeState, getPasteContextLevel } from '../extentions/helper'
import { isEntireDocumentSelected } from '../extentions/helper/selection'
import {
  createCopyPastePlugin,
  createHierarchyValidationPlugin,
  createRangeSelectionPlugin
} from '../extentions/plugins'
import { HeadingAttributes } from '../extentions/types'
import wrapContentWithHeading from '../extentions/wrapContentWithHeading'

const syncHeadingDomId = (dom: HTMLElement, content: HTMLElement, headingId: string) => {
  if (headingId) {
    dom.setAttribute('data-id', headingId)
    content.setAttribute('data-id', headingId)
    return
  }

  dom.removeAttribute('data-id')
  content.removeAttribute('data-id')
}

const getClosestAncestorHeading = ($pos: ResolvedPos): ProseMirrorNode | null => {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const nodeAtDepth = $pos.node(depth)
    if (nodeAtDepth?.type?.name === TIPTAP_NODES.HEADING_TYPE) {
      return nodeAtDepth
    }
  }
  return null
}

const Heading = Node.create({
  name: TIPTAP_NODES.HEADING_TYPE,
  content: 'contentHeading contentWrapper',
  group: 'section',
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
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('div')

      const headingId = node.attrs.id || ''

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        level: node.firstChild?.attrs.level,
        'data-id': headingId
      })

      const nodeState = getNodeState(headingId)

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value as string))

      dom.classList.add(nodeState.crinkleOpen ? 'opened' : 'closed')

      const content = document.createElement('div')

      content.classList.add('wrapBlock')
      syncHeadingDomId(dom, content, headingId)
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

          // Keep update side-effect free: only sync DOM attributes.
          // Dispatching transactions from node view update can cause re-entrant update cycles.
          const newLevel = updatedNode.firstChild?.attrs.level
          if (newLevel && dom.getAttribute('level') !== newLevel.toString()) {
            dom.setAttribute('level', newLevel)
          }

          const prevHeadingId = dom.getAttribute('data-id') || ''
          const newHeadingId = updatedNode.attrs.id || ''

          if (prevHeadingId !== newHeadingId) {
            syncHeadingDomId(dom, content, newHeadingId)
          }

          return true
        }
      }
    }
  },
  parseHTML() {
    return [
      // Primary parser for current schema-generated heading nodes.
      { tag: `div[data-type="${this.name}"]` },
      // Backward-compatible parser for legacy serialized markup.
      { tag: `div.${TIPTAP_NODES.HEADING_TYPE}[level]` }
    ]
  },
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name
      }),
      0
    ]
  },
  addCommands() {
    return {
      normalText:
        () =>
        ({ state, tr, dispatch, editor }: CommandProps) => {
          changeHeadingToParagraphs({ state, tr, dispatch, editor })
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

          wrapContentWithHeading({ state, tr, dispatch, editor }, attributes)
          return true
        }
    }
  },
  addKeyboardShortcuts() {
    const levelShortcuts: Record<string, () => boolean> = {}
    for (const level of this.options.levels as number[]) {
      levelShortcuts[`Mod-Alt-${level}`] = () =>
        this.editor.commands.wrapBlock({
          level
        })
    }

    return {
      Delete: () => {
        const { $anchor, $head } = this.editor.state.selection
        // we need detect the selection
        if ($anchor?.pos === $head?.pos) return false

        console.info('[Heading] Delete key pressed')

        if (isEntireDocumentSelected(this.editor.state.doc, $anchor.pos, $head.pos)) return false

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
        const parent = getClosestAncestorHeading($head)
        if (!parent) return false

        // INFO: if the content is hide, do not anything
        // ! this open in the Heading block is wrong and Have to change, It's opposite
        const headingId = parent.attrs.id
        const nodeState = getNodeState(headingId)

        if (!nodeState.crinkleOpen) return true

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        // TODO: find better way for this 4
        const parentLastChild = parent.lastChild
        const parentLastChildFirstChild = parentLastChild?.firstChild

        if (
          parent.childCount === 1 ||
          parentLastChildFirstChild?.type.name === TIPTAP_NODES.HEADING_TYPE
        ) {
          // If there is not any contentWrapper
          // if first child of the heading is another heading
          // console.log(parent.lastChild.type.name === "contentWrapper")
          // console.log(parent.lastChild.content.lastChild.type.name === "heading")
          // if the contentWrapper does not contain any content
          if (
            !parentLastChild ||
            parentLastChild.content.size === 0 ||
            parentLastChildFirstChild?.content.size === 0
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
      ...levelShortcuts,
      // Add shortcut for normal text (level 0)
      'Mod-Alt-0': () => this.editor.commands.normalText()
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
          const attributes = callOrReturn(config.getAttributes, undefined, match) || {}

          // HN-10 §6.1: child level must be > parent level.
          // If typing "######" inside an H8, creating H6 would violate this rule.
          // Delete the hashes but skip heading creation — let the hierarchy
          // validation plugin avoid having to extract and reposition.
          const contextLevel = getPasteContextLevel(state.doc, range.from)
          if (contextLevel > 0 && (attributes as HeadingAttributes).level <= contextLevel) {
            state.tr.delete(range.from, range.to)
            return
          }

          state.tr.delete(range.from, range.to)
          wrapContentWithHeading(
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

export { Heading as default, Heading }
