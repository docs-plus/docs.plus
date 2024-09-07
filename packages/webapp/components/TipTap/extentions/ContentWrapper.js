import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { getNodeState } from './helper.js'
import PubSub from 'pubsub-js'
import ENUMS from '../enums.js'
import deleteSelectedRange from './deleteSelectedRange.js'
import { TextSelection } from '@tiptap/pm/state'

function extractContentWrapperBlocks(doc) {
  const result = []
  const record = (from, to, nodeSize, childCount, headingId) => {
    result.push({ from, to, nodeSize, childCount, headingId })
  }
  let lastHeadingId

  // For each node in the document
  doc.descendants((node, pos) => {
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
      const nodeSize = node.content.size
      const childCount = node.childCount

      record(pos, pos + nodeSize, nodeSize, childCount, lastHeadingId)
    }
  })

  return result
}

function createCrinkleNode(prob) {
  const foldEl = document.createElement('div')

  foldEl.classList.add('foldWrapper')
  const step = 2400
  const lines = 2 + Math.floor(prob.nodeSize / step)
  const clampedLines = Math.min(Math.max(lines, 2), 6)

  for (let i = 0; i <= clampedLines; i++) {
    const line = document.createElement('div')

    line.classList.add('fold')
    line.classList.add(`l${i}`)
    foldEl.append(line)
  }
  foldEl.setAttribute('data-clampedLines', clampedLines + 1)

  foldEl.addEventListener('click', (e) => {
    const heading = e.target.closest('.heading')
    if (!heading.classList.contains('closed')) return

    const headingId = heading.getAttribute('data-id')
    const open = heading.classList.contains('open')

    PubSub.publish(ENUMS.EVENTS.FOLD_AND_UNFOLD, { headingId, open: open })
  })

  foldEl.addEventListener('mouseenter', (e) => {
    const heading = e.target.closest('.heading')
    const classList = heading.classList

    if (classList.contains('opening') || classList.contains('closing')) return

    const elem = e.target.closest('.foldWrapper')
    elem.style.transitionTimingFunction = 'ease-in-out'
    elem.style.height = '70px'
  })

  foldEl.addEventListener('mouseleave', (e) => {
    const heading = e.target.closest('.heading')
    const classList = heading.classList

    if (classList.contains('opening') || classList.contains('closing')) return

    const elem = e.target.closest('.foldWrapper')
    elem.style.transitionTimingFunction = 'ease-in-out'
    elem.style.height = '20px'
  })

  return foldEl
}

function buildDecorations(doc) {
  const decos = []
  const contentWrappers = extractContentWrapperBlocks(doc)

  contentWrappers.forEach((prob) => {
    const decorationWidget = Decoration.widget(prob.from, createCrinkleNode(prob), {
      side: -1,
      key: prob.headingId
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

function expandElement(elem, collapseClass, headingId, open) {
  const startHeight = window.getComputedStyle(elem).height
  const headingSection = document.querySelector(`.heading[data-id="${headingId}"]`)
  const wrapperBlock = headingSection.querySelector('.foldWrapper')

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
  name: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
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
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name
      }),
      ['div', { class: 'contents' }, 0]
    ]
  },
  addNodeView() {
    return ({ editor, getPos, HTMLAttributes, node }) => {
      const dom = document.createElement('div')
      const content = document.createElement('div')
      content.classList.add('contents')
      dom.appendChild(content)

      // get parent node
      const parentNode = editor.state.doc?.resolve(getPos())
      const headingId =
        getPos() - parentNode.nodeBefore?.nodeSize === 1 ? '1' : parentNode.parent?.attrs.id

      const nodeState = getNodeState(headingId)

      dom.setAttribute('class', 'contentWrapper', nodeState)

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

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value))

      dom.addEventListener('toggleHeadingsContent', ({ detail }) => {
        const section = detail.el
        // editor.commands.focus()

        if (/*!editor.isEditable &&*/ typeof getPos !== 'function') return false

        const { tr } = editor.state

        tr.setMeta('addToHistory', false)
        // for trigger table of contents
        tr.setMeta(ENUMS.EVENTS.FOLD_AND_UNFOLD, true)

        const pos = getPos()
        const currentNode = tr.doc.nodeAt(pos)

        if (
          (currentNode === null || currentNode === void 0 ? void 0 : currentNode.type) !== this.type
        ) {
          return false
        }

        const open = section.classList.contains('collapsed') ? true : false

        editor.view.dispatch(tr)

        expandElement(section, 'collapsed', detail.headingId, open)
      })

      return {
        dom,
        contentDOM: content,
        ignoreMutation(mutation) {
          if (mutation.type === 'selection') {
            return false
          }
          return !dom.contains(mutation.target) || dom === mutation.target
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
      Backspace: () => {
        const { editor } = this
        const { schema, selection, tr } = editor.state
        const { $anchor, $from, $head, $to } = selection
        const blockRange = $from.blockRange($to)

        // if we have selection, node range || multiple lines block
        if ($anchor.pos !== $head.pos) {
          console.info('[Heading][Backspace]: Delete selected range')
          return deleteSelectedRange(editor)
        }

        // If backspace hit not at the start of the node, do nothing
        // TODO: Revise this condition, maybe it's better to use "textOffset"
        if ($anchor.parentOffset !== 0) return false

        const contentWrapper = $anchor.doc?.nodeAt($from?.before(blockRange.depth))
        const nodeType = contentWrapper.type.name

        // If the Backspace is not in the contentWrapper, do nothing
        if (
          nodeType === schema.nodes.contentHeading.name ||
          nodeType !== schema.nodes.contentWrapper.name
        ) {
          return
        }

        // Get the contentWrapper node pos
        const contentWrapperPos = $from.before(2)

        // When cursor is in the first line of contentWrapper
        if (blockRange.start - 1 === contentWrapperPos) {
          // If there is no previous node in the selection (i.e., current node is the first node of the contentWrapper)
          if ($anchor.nodeBefore === null) {
            // If there's a text node following the current node
            if ($anchor.nodeAfter?.type.name === ENUMS.NODES.TEXT_TYPE) {
              const paragraphContent = $anchor.path
                .findLast((node) => node?.type?.name === ENUMS.NODES.PARAGRAPH_TYPE)
                .content.toJSON()

              // Filter out the "hardBreak" nodes from the paragraph content
              const filteredContent = paragraphContent.filter(
                (node) => node.type.name !== 'hardBreak'
              )

              const cloneCurrentNodeAsParagraph = {
                type: ENUMS.NODES.PARAGRAPH_TYPE,
                content: filteredContent
              }

              const newNode = editor.state.schema.nodeFromJSON(cloneCurrentNodeAsParagraph)

              tr.delete(blockRange.start, blockRange.end)

              // we can not append block node to contentHeading node, so we just append the inline node
              tr.insert(blockRange.start - 2, newNode.content)

              const newSelection = new TextSelection(tr.doc.resolve(blockRange.start - 2))
              tr.setSelection(newSelection)

              return editor.view.dispatch(tr)
            } else {
              // If no text node is following, just delete the current node and move the cursor to the end of the heading
              return this.editor
                .chain()
                .deleteRange({ from: blockRange.start, to: blockRange.end })
                .setTextSelection(blockRange.start - 2)
                .scrollIntoView()
                .run()
            }
          }
        }
      },
      // Escape node on double enter
      Enter: () => {
        const { state, dispatch } = this.editor.view
        const { selection, doc } = state
        const { $from, $to } = selection

        // Check if we're in a ContentWrapper
        const contentWrapper = $from.node($from.depth - 1)
        if (contentWrapper.type.name !== ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
          return false
        }

        // Check if there's a heading before the cursor in this ContentWrapper
        let hasHeadingBefore = false
        contentWrapper.forEach((node, offset) => {
          if (node.type.name === ENUMS.NODES.HEADING_TYPE && offset < $from.parentOffset) {
            hasHeadingBefore = true
          }
        })

        if (hasHeadingBefore) {
          // If there's a heading before, only allow creating new headings
          return this.editor.commands.setNode(ENUMS.NODES.HEADING_TYPE)
        }

        // If no heading before, allow normal paragraph insertion
        return false // Let Tiptap handle default Enter behavior
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('crinkle'),
        state: {
          init(_, { doc }) {
            return buildDecorations(doc)
          },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

export { ContentWrapper, ContentWrapper as default }
