import { Node, mergeAttributes, findParentNode, defaultBlockAt } from '@tiptap/core'
import { Selection, Plugin, TextSelection, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import PubSub from 'pubsub-js'

import { getNodeState } from './helper'

function extractContentWrapperBlocks (doc) {
  const result = []
  const record = (from, to, nodeSize, childCount, headingId) => {
    result.push({ from, to, nodeSize, childCount, headingId })
  }
  let lastHeadingId

  // For each node in the document
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === 'contentWrapper') {
      const nodeSize = node.content.size
      const childCount = node.childCount

      record(pos, pos + nodeSize, nodeSize, childCount, lastHeadingId)
    }
  })

  return result
}

function crinkleNode (prob) {
  const foldEl = document.createElement('div')

  foldEl.classList.add('foldWrapper')
  const step = 1000
  const lines = 3 + Math.floor(prob.nodeSize / step)
  const clampedLines = Math.min(Math.max(lines, 3), 10)

  for (let i = 0; i <= clampedLines; i++) {
    const line = document.createElement('div')

    line.classList.add('fold')
    line.classList.add(`l${i}`)
    foldEl.append(line)
  }
  foldEl.setAttribute('data-clampedLines', clampedLines + 1)
  foldEl.addEventListener('click', (e) => {
    if (!e.target.closest('.heading').classList.contains('closed')) return
    e.target.parentElement.parentElement.querySelector('.btnFold')?.click()
  })

  return foldEl
}

function lintDeco (doc) {
  const decos = []
  const contentWrappers = extractContentWrapperBlocks(doc)

  contentWrappers.forEach(prob => {
    const decorationWidget = Decoration.widget(prob.from, crinkleNode(prob), {
      side: -1,
      key: prob.headingId
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

function expandElement (elem, collapseClass, headingId, open) {
  // debugger;
  elem.style.height = ''
  elem.style.transition = 'none'
  elem.style.transitionTimingFunction = 'ease-in-out'
  const startHeight = window.getComputedStyle(elem).height
  const contentWrapper = document.querySelector(`.heading[data-id="${headingId}"]`)

  contentWrapper.classList.remove('opend')
  contentWrapper.classList.remove('closed')
  contentWrapper.classList.remove('closing')
  contentWrapper.classList.remove('opening')
  elem.classList.add('overflow-hidden')

  contentWrapper.classList.add(open ? 'opening' : 'closing')

  // Remove the collapse class, and force a layout calculation to get the final height
  elem.classList.toggle(collapseClass)
  const height = window.getComputedStyle(elem).height

  // Set the start height to begin the transition
  elem.style.height = startHeight

  // wait until the next frame so that everything has time to update before starting the transition
  requestAnimationFrame(() => {
    elem.style.transition = ''

    requestAnimationFrame(() => {
      elem.style.height = height
    })
  })

  function callback () {
    elem.style.height = ''
    if (open) {
      contentWrapper.classList.remove('closed')
      contentWrapper.classList.remove('closing')
      contentWrapper.classList.add('opend')
      elem.classList.remove('overflow-hidden')
    } else {
      contentWrapper.classList.remove('opening')
      contentWrapper.classList.remove('opend')
      contentWrapper.classList.add('closed')
      elem.classList.add('overflow-hidden')
    }

    elem.removeEventListener('transitionend', callback)
  }

  // Clear the saved height values after the transition
  elem.addEventListener('transitionend', callback)
}

const HeadingsContent = Node.create({
  name: 'contentWrapper',
  content: '(heading|paragraph|block)*',
  defining: true,
  selectable: false,
  isolating: true,
  draggable: false,
  allowGapCursor: false,
  addOptions () {
    return {
      persist: true,
      id: null,
      HTMLAttributes: {}
    }
  },
  parseHTML () {
    return [
      {
        tag: `div[data-type="${this.name}"]`
      }
    ]
  },
  addAttributes () {
    return {
      id: {
        default: null,
        rendered: false
      }
    }
  },
  renderHTML ({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0
    ]
  },
  addNodeView () {
    return ({ editor, getPos, node, HTMLAttributes }) => {
      const dom = document.createElement('div')

      // get parent node
      const upperNode = editor.state.doc.nodeAt(getPos() - 2)
      const parentNode = editor.state.doc.nodeAt(getPos() - upperNode.nodeSize - 2)
      const headingId = parentNode?.attrs.id

      const nodeState = getNodeState(headingId)

      dom.setAttribute('class', 'contentWrapper')

      const attrs = {
        'data-type': this.name
      }
      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs)

      if (!nodeState.crinkleOpen) {
        dom.classList.add('overflow-hidden')
        dom.classList.add('collapsed')
        dom.classList.add('closed')
      } else {
        dom.classList.remove('overflow-hidden')
        dom.classList.remove('collapsed')
        dom.classList.remove('closed')
        dom.classList.add('opend')
      }

      const content = document.createElement('div')

      content.classList.add('contents')
      dom.append(content)

      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value))
      dom.addEventListener('toggleHeadingsContent', ({ detail }) => {
        const section = detail.el
        const headingMap = JSON.parse(localStorage.getItem('headingMap')) || []
        const nodeState = headingMap.find(h => h.headingId === detail.headingId) || { crinkleOpen: true }

        editor.commands.focus()

        if (editor.isEditable && typeof getPos === 'function') {
          const { tr } = editor.state

          const pos = getPos()
          const currentNode = tr.doc.nodeAt(pos)

          if ((currentNode === null || currentNode === void 0 ? void 0 : currentNode.type) !== this.type) {
            return false
          }

          if (nodeState.crinkleOpen) {
            section.classList.add('overflow-hidden')
          }

          tr.setMeta('addToHistory', false)
          // for trigger table of contents
          tr.setMeta('fold&unfold', true)
          editor.view.dispatch(tr)

          PubSub.publish('toggleHeadingsContent', { headingId: detail.headingId, crinkleOpen: !nodeState.crinkleOpen })
          expandElement(section, 'collapsed', detail.headingId, !nodeState.crinkleOpen)
        }
      })

      return {
        dom,
        contentDOM: dom,
        ignoreMutation (mutation) {
          if (mutation.type === 'selection') {
            return false
          }

          return !dom.contains(mutation.target) || dom === mutation.target
        },
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false
          }

          return true
        }
      }
    }
  },
  addKeyboardShortcuts () {
    return {
      Backspace: (data) => {
        const { schema, selection } = this.editor.state
        const { empty, $anchor, $head, $from, $to } = selection
        const { start, end, depth } = $from.blockRange($to)

        // if backspace hit in the node that not have any content
        if ($anchor.parentOffset !== 0) return false
        const contentWrapper = $anchor.doc?.nodeAt($from?.before(depth))

        // if Backspace is in the contentWrapper
        if (contentWrapper.type.name !== schema.nodes.contentHeading.name) {
          if (contentWrapper.type.name !== schema.nodes.contentWrapper.name) return
          // INFO: if the contentWrapper block has one child just change textSelection
          // Otherwise remove the current line and move the textSelection to the

          if (contentWrapper.childCount === 1) {
            return this.editor.chain()
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          } else {
            return this.editor.chain()
              .deleteRange({ from: start, to: end })
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          }
        }
      },
      // Escape node on double enter
      Enter: ({ editor }) => { }
    }
  },
  addProseMirrorPlugins () {
    return [
      new Plugin({
        key: new PluginKey('crinkle'),
        state: {
          init (_, { doc }) {
            return lintDeco(doc)
          },
          apply (tr, old) {
            return tr.docChanged ? lintDeco(tr.doc) : old
          }
        },
        props: {
          decorations (state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

export { HeadingsContent, HeadingsContent as default }
