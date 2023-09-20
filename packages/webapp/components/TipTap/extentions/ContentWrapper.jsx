import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { getNodeState } from './helper'
import PubSub from 'pubsub-js'
import ENUMS from '../enums'
import deleteSelectedRange from './deleteSelectedRange.js'

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
  content: '(heading|paragraph|block)*',
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
        tag: `div[data-type="${this.name}"]`
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
      0
    ]
  },
  addNodeView() {
    return ({ editor, getPos, HTMLAttributes }) => {
      const dom = document.createElement('div')

      // get parent node
      const parentNode = editor.state.doc?.resolve(getPos())
      const headingId =
        getPos() - parentNode.nodeBefore.nodeSize === 1 ? '1' : parentNode.parent?.attrs.id

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

      const content = document.createElement('div')

      content.classList.add('contents')
      dom.append(content)

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value))

      dom.addEventListener('toggleHeadingsContent', ({ detail }) => {
        const section = detail.el
        // editor.commands.focus()

        if (!editor.isEditable && typeof getPos !== 'function') return false

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
        contentDOM: dom,
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
      Backspace: () => {
        const { editor } = this
        const { schema, selection, doc } = editor.state
        const { $anchor, $from, $to } = selection
        const blockRange = $from.blockRange($to)

        if (selection.from !== selection.to)
          return deleteSelectedRange({
            editor,
            state: editor.state,
            tr: editor.state.tr,
            view: editor.view
          })

        // If backspace hit not at the start of the node, do nothing
        if ($anchor.parentOffset !== 0) return false

        const contentWrapper = $anchor.doc?.nodeAt($from?.before(blockRange.depth))

        // If the Backspace is not in the contentWrapper, do nothing
        if (
          contentWrapper.type.name === schema.nodes.contentHeading.name ||
          contentWrapper.type.name !== schema.nodes.contentWrapper.name
        )
          return

        // Get the contentWrapper node pos
        const contentWrapperPos = $from.before(2)

        // When cursor is in the first line of contentWrapper
        if (blockRange.start - 1 === contentWrapperPos) {
          // If there is no previous node in the selection (i.e., current node is the first node of the contentWrapper)
          if ($anchor.nodeBefore === null) {
            // If there's a text node following the current node
            if ($anchor.nodeAfter?.type.name === ENUMS.NODES.TEXT_TYPE) {
              const clonedTextNode = $anchor.nodeAfter.copy($anchor.nodeAfter.content)

              // Delete the current node, move the cursor to the end of the previous node (the heading),
              // insert the cloned text node there, and focus the cursor there
              return this.editor
                .chain()
                .deleteRange({ from: blockRange.start, to: blockRange.end })
                .setTextSelection(blockRange.start - 2)
                .insertContent(clonedTextNode.toJSON())
                .scrollIntoView()
                .run()
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
      Enter: () => {}
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
