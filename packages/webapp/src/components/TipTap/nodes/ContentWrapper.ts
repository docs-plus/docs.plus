import { mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { type DOMOutputSpec, TIPTAP_NODES, TRANSACTION_META, type ViewMutationRecord } from '@types'

import deleteSelectedRange from '../extentions/deleteSelectedRange'
import { getNodeState } from '../extentions/helper'
import { createCrinklePlugin } from '../extentions/plugins'

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
  headingSection.classList.remove('opend', 'closed', 'closing', 'opening')
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
      headingSection.classList.add('opend')
      elem.classList.remove('overflow-hidden')
    } else {
      headingSection.classList.remove('opening', 'opend', 'closing')
      headingSection.classList.add('closed')
      elem.classList.add('overflow-hidden')
    }

    elem.removeEventListener('transitionend', callback)
  }

  elem.addEventListener('transitionend', callback)
}

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
        dom.classList.add('opend')
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
          return !dom.contains(mutation.target as any) || dom === mutation.target
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
          console.info('[Heading][Backspace]: Delete selected range')
          // Check if both $anchor and $head parents are content headings
          if (
            $anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE &&
            $head.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE
          ) {
            return false
          }

          // Check if selection covers entire document content
          // Due to document schema hierarchy, content starts at position 2 and ends at docSize - 3
          const docSize = editor.state.doc.content.size
          const isEntireDocument = $anchor.pos === 2 && $head.pos === docSize - 3
          if (isEntireDocument) return false

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
              const paragraphNode = ($anchor as any).path.findLast(
                (node: any) => node?.type?.name === TIPTAP_NODES.PARAGRAPH_TYPE
              )
              const paragraphContent = paragraphNode.content.toJSON()

              // Filter out the "hardBreak" nodes from the paragraph content
              const filteredContent = paragraphContent.filter(
                (node: any) => node.type.name !== TIPTAP_NODES.HARD_BREAK_TYPE
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
      // Escape node on double enter
      Enter: () => {
        const { state } = this.editor.view
        const { selection } = state
        const { $from } = selection

        // Check if we're in a ContentWrapper
        const contentWrapper = $from.node($from.depth - 1)
        if (contentWrapper?.type?.name !== TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
          return false
        }

        // Check if there's a heading before the cursor in this ContentWrapper
        let hasHeadingBefore = false
        contentWrapper.forEach((node, offset) => {
          if (node.type.name === TIPTAP_NODES.HEADING_TYPE && offset < $from.parentOffset) {
            hasHeadingBefore = true
          }
        })

        if (hasHeadingBefore) {
          // If there's a heading before, only allow creating new headings
          return this.editor.commands.setNode(TIPTAP_NODES.HEADING_TYPE)
        }

        // If no heading before, allow normal paragraph insertion
        return false // Let Tiptap handle default Enter behavior
      }
    }
  },
  addProseMirrorPlugins() {
    return [createCrinklePlugin()]
  }
})

export { ContentWrapper, ContentWrapper as default }
