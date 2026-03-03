import { mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import {
  type DOMOutputSpec,
  type ProseMirrorNode,
  type ResolvedPos,
  TIPTAP_NODES,
  TRANSACTION_META,
  type ViewMutationRecord
} from '@types'
import { logger } from '@utils/logger'

import deleteSelectedRange from '../extensions/deleteSelectedRange'
import { getNodeState } from '../extensions/helper'
import { isEntireDocumentSelected } from '../extensions/helper/selection'
import { createCrinklePlugin } from '../extensions/plugins'

const getClosestAncestorNodeByTypeName = (
  $pos: ResolvedPos,
  targetTypeName: string
): ProseMirrorNode | null => {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth)
    if (node?.type?.name === targetTypeName) {
      return node
    }
  }
  return null
}

function expandElement(
  elem: HTMLElement,
  collapseClass: string,
  headingId: string,
  open: boolean
): void {
  const startHeight = window.getComputedStyle(elem).height
  const headingSection = document.querySelector(`.heading[data-id="${headingId}"]`) as HTMLElement
  const wrapperBlock = headingSection.querySelector('.foldWrapper') as HTMLElement

  elem.style.height = ''
  elem.style.transition = 'none'
  elem.style.transitionTimingFunction = 'ease-in-out'

  wrapperBlock.style.height = startHeight
  wrapperBlock.style.position = 'absolute'
  wrapperBlock.style.transitionTimingFunction = 'ease-in-out'
  wrapperBlock.style.transition = 'none'

  elem.classList.add('overflow-hidden')
  headingSection.classList.remove('opened', 'closed', 'closing', 'opening')
  headingSection.classList.add(open ? 'opening' : 'closing')

  elem.classList.toggle(collapseClass)
  const height = window.getComputedStyle(elem).height

  elem.style.height = startHeight

  requestAnimationFrame(() => {
    elem.style.transition = ''
    wrapperBlock.style.transition = ''

    elem.style.height = height
    wrapperBlock.style.height = height
  })

  function callback() {
    elem.style.height = ''

    wrapperBlock.style.height = ''
    wrapperBlock.style.position = 'relative'

    if (open) {
      headingSection.classList.remove('closed', 'closing', 'opening')
      headingSection.classList.add('opened')
      elem.classList.remove('overflow-hidden')
    } else {
      headingSection.classList.remove('opening', 'opened', 'closing')
      headingSection.classList.add('closed')
      elem.classList.add('overflow-hidden')
    }

    elem.removeEventListener('transitionend', callback)
  }

  elem.addEventListener('transitionend', callback)
}

/**
 * ContentWrapper — the body container inside each heading section.
 * Holds block content (paragraphs, lists, etc.) followed by child headings.
 *
 * NON-COLLABORATIVE BY DESIGN: The fold/unfold animation state for
 * contentWrapper sections is stored per-browser in localStorage + IndexedDB
 * via getNodeState/headingTogglePlugin. Each collaborator sees their own
 * fold state independently. This is intentional — fold state is a user
 * preference, not document state.
 */
const ContentWrapper = Node.create({
  name: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
  content: '(block)* heading*',
  defining: true,
  selectable: false,
  isolating: true,
  draggable: false,
  allowGapCursor: false,
  addOptions() {
    return {
      persist: true,
      id: null,
      HTMLAttributes: {}
    }
  },
  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
        contentElement: 'div.contents'
      }
    ]
  },
  addAttributes() {
    return {
      id: {
        default: null,
        rendered: false
      }
    }
  },
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name
      }),
      ['div', { class: 'contents' }, 0]
    ]
  },
  addNodeView() {
    return ({ editor, getPos, HTMLAttributes }) => {
      const dom = document.createElement('div')
      const content = document.createElement('div')
      content.classList.add('contents')
      dom.appendChild(content)

      // get parent node
      const pos = getPos()
      const parentNode = pos !== undefined ? editor.state.doc?.resolve(pos) : null
      const headingId = parentNode?.parent?.attrs.id

      const nodeState = getNodeState(headingId)

      dom.setAttribute('class', 'contentWrapper')

      const attrs = {
        'data-type': this.name
      }
      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs)

      if (!nodeState.crinkleOpen) {
        dom.classList.add('overflow-hidden', 'collapsed', 'closed')
      } else {
        dom.classList.remove('overflow-hidden', 'collapsed', 'closed')
        dom.classList.add('opened')
      }

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value as string))

      dom.addEventListener('toggleHeadingsContent', ((event: CustomEvent) => {
        const section = event.detail.el
        // editor.commands.focus()

        if (/*!editor.isEditable &&*/ typeof getPos !== 'function') return false

        const { tr } = editor.state

        tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false)
        // Trigger table of contents update
        tr.setMeta(TRANSACTION_META.FOLD_AND_UNFOLD, true)

        const pos = getPos()
        if (pos === undefined) return false
        const currentNode = tr.doc.nodeAt(pos)

        if (currentNode?.type !== this.type) {
          return false
        }

        const open = section.classList.contains('collapsed') ? true : false

        editor.view.dispatch(tr)

        expandElement(section, 'collapsed', event.detail.headingId, open)
      }) as EventListener)

      return {
        dom,
        contentDOM: content,
        ignoreMutation(mutation: ViewMutationRecord) {
          if (mutation.type === 'selection') {
            return false
          }
          return !dom.contains(mutation.target as globalThis.Node) || dom === mutation.target
        },
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false
          }
          return true
        }
      }
    }
  },
  addKeyboardShortcuts() {
    return {
      //TODO: refactor needed
      Backspace: (): boolean => {
        const { editor } = this
        const { schema, selection, tr } = editor.state
        const { $anchor, $from, $head, $to } = selection
        const blockRange = $from.blockRange($to)

        // if we have selection, node range || multiple lines block
        if ($anchor.pos !== $head.pos) {
          logger.info('[Heading][Backspace]: Delete selected range')
          // Check if both $anchor and $head parents are content headings
          if (
            $anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE &&
            $head.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE
          ) {
            return false
          }

          if (isEntireDocumentSelected(editor.state.doc, $anchor.pos, $head.pos)) return false

          return deleteSelectedRange(editor)
        }

        // If backspace hit not at the start of the node, do nothing
        // TODO: Revise this condition, maybe it's better to use "textOffset"
        if ($anchor.parentOffset !== 0) return false

        const contentWrapper = $anchor.doc?.nodeAt($from?.before(blockRange!.depth))
        const nodeType = contentWrapper!.type.name

        // If the Backspace is not in the contentWrapper, do nothing
        if (
          nodeType === schema.nodes.contentHeading.name ||
          nodeType !== schema.nodes.contentWrapper.name
        ) {
          return false
        }

        // Get the contentWrapper node pos
        const contentWrapperPos = $from.before(2)

        // When cursor is in the first line of contentWrapper
        if (blockRange!.start - 1 === contentWrapperPos) {
          // If there is no previous node in the selection (i.e., current node is the first node of the contentWrapper)
          if ($anchor.nodeBefore === null) {
            // If there's a text node following the current node
            if ($anchor.nodeAfter?.type.name === TIPTAP_NODES.TEXT_TYPE) {
              const paragraphNode = getClosestAncestorNodeByTypeName(
                $anchor,
                TIPTAP_NODES.PARAGRAPH_TYPE
              )
              if (!paragraphNode) return false
              const paragraphContent = paragraphNode.content.toJSON()

              // Filter out the "hardBreak" nodes from the paragraph content
              const filteredContent = paragraphContent.filter(
                (node: { type?: string }) => node.type !== TIPTAP_NODES.HARD_BREAK_TYPE
              )

              const cloneCurrentNodeAsParagraph = {
                type: TIPTAP_NODES.PARAGRAPH_TYPE,
                content: filteredContent
              }

              const newNode = editor.state.schema.nodeFromJSON(cloneCurrentNodeAsParagraph)

              tr.delete(blockRange!.start, blockRange!.end)

              // we can not append block node to contentHeading node, so we just append the inline node
              tr.insert(blockRange!.start - 2, newNode.content)

              const newSelection = new TextSelection(tr.doc.resolve(blockRange!.start - 2))
              tr.setSelection(newSelection)

              editor.view.dispatch(tr)
              return true
            } else {
              // If no text node is following, just delete the current node and move the cursor to the end of the heading
              this.editor
                .chain()
                .deleteRange({ from: blockRange!.start, to: blockRange!.end })
                .setTextSelection(blockRange!.start - 2)
                .scrollIntoView()
                .run()
              return true
            }
          }
        }

        return false
      },
      // When the cursor is in the heading zone of a contentWrapper (after child
      // headings), Enter should create a new sibling heading — not a paragraph.
      // We build a structurally valid heading node (contentHeading + contentWrapper)
      // instead of using setNode, which would produce an invalid heading.
      Enter: () => {
        const { state } = this.editor.view
        const { schema, selection } = state
        const { $from } = selection

        const contentWrapper = $from.node($from.depth - 1)
        if (contentWrapper?.type?.name !== TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
          return false
        }

        let lastHeadingLevel: number | null = null
        contentWrapper.forEach((node, offset) => {
          if (node.type.name === TIPTAP_NODES.HEADING_TYPE && offset < $from.parentOffset) {
            lastHeadingLevel = node.firstChild?.attrs?.level ?? null
          }
        })

        if (lastHeadingLevel === null) {
          return false
        }

        const headingNode = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create(
          { level: lastHeadingLevel },
          [
            schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: lastHeadingLevel }),
            schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
              schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
            ])
          ]
        )

        const insertPos = $from.end($from.depth - 1)
        const tr = state.tr.insert(insertPos, headingNode)
        const cursorPos = insertPos + 2
        tr.setSelection(TextSelection.create(tr.doc, cursorPos))
        this.editor.view.dispatch(tr)
        return true
      }
    }
  },
  addProseMirrorPlugins() {
    return [createCrinklePlugin()]
  }
})

export { ContentWrapper, ContentWrapper as default }
