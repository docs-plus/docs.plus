// TODO: Refactor this file, it's too long and hard to understand

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node, mergeAttributes } from '@tiptap/core'
import { db } from '../../../db'
import { copyToClipboard } from './helper'
import onHeading from './normalText/onHeading'
import PubSub from 'pubsub-js'
import ENUMS from '../enums'
import { ChatLeftSVG } from '@icons'
import { CHAT_OPEN } from '@services/eventsHub'

let isProcessing = false

// Helpers
const extractContentHeadingBlocks = (doc) => {
  const result = []
  const record = (from, to, headingId, node) => {
    result.push({ from, to, headingId, node })
  }
  let lastHeadingId

  // For each node in the document
  doc.descendants((node, pos) => {
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
      const nodeSize = node.nodeSize

      record(pos, pos + nodeSize, lastHeadingId, node)
    }
  })

  return result
}

const dispatchToggleHeadingSection = (el) => {
  const headingId = el.getAttribute('data-id')
  const selectFirstHeading = document
    .querySelector(".ProseMirror .heading[data-id='1']")
    .querySelector('div.contentWrapper')
  const detailsContent =
    headingId === '1' ? selectFirstHeading : el.querySelector('div.contentWrapper')
  const event = new CustomEvent('toggleHeadingsContent', {
    detail: { headingId, el: detailsContent }
  })

  detailsContent === null || detailsContent === void 0
    ? void 0
    : detailsContent.dispatchEvent(event)
}

const buttonWrapper = (editor, { headingId, from, node }) => {
  const buttonWrapper = document.createElement('div')
  const btnToggleHeading = document.createElement('button')
  const btnChatBox = document.createElement('button')
  const unreadMsgCount = document.createElement('span')

  buttonWrapper.classList.add('buttonWrapper')

  btnChatBox.setAttribute('class', 'btn_openChatBox')
  btnChatBox.setAttribute('type', 'button')
  btnToggleHeading.classList.add('btnFold')
  btnToggleHeading.setAttribute('type', 'button')

  btnChatBox.innerHTML = ChatLeftSVG({ size: 24 })

  btnChatBox.prepend(unreadMsgCount)

  btnChatBox.addEventListener('click', (e) => {
    e.preventDefault()

    PubSub.publish(CHAT_OPEN, {
      headingId
    })

    editor
      .chain()
      .focus(from + node.nodeSize - 1)
      .run()
  })

  buttonWrapper.append(btnToggleHeading)
  buttonWrapper.append(btnChatBox)

  // copy the link to clipboard
  const href = document.createElement('span')

  href.innerHTML = '#'
  href.setAttribute('href', `?id=${headingId}`)
  href.setAttribute('target', `_tab`)
  href.setAttribute('rel', `noreferrer`)
  href.classList.add('btn_copyLink')
  href.addEventListener('click', (e) => {
    e.preventDefault()
    const url = new URL(window.location)

    url.searchParams.set('id', headingId)
    window.history.pushState({}, '', url)
    copyToClipboard(url.href)
    editor
      .chain()
      .focus(from + node.nodeSize - 1)
      .run()
  })
  href.contenteditable = false
  buttonWrapper.append(href)

  return buttonWrapper
}

const appendButtonsDec = (doc, editor) => {
  const decos = []
  const contentWrappers = extractContentHeadingBlocks(doc)

  contentWrappers.forEach((prob) => {
    const decorationWidget = Decoration.widget(prob.to, buttonWrapper(editor, prob), {
      side: -1,
      key: prob.headingId,
      ignoreSelection: true
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

const handleHeadingToggle = (editor, { headingId }) => {
  const { tr } = editor.state
  const headingNodeEl = editor.view.dom.querySelector(
    `.ProseMirror .heading[data-id="${headingId}"]`
  )

  if (isProcessing) return
  isProcessing = true

  if (!headingNodeEl) {
    isProcessing = false
    return
  }

  // TODO: I have no idea why this is working like this!

  let nodePos
  try {
    nodePos = editor.view.state.doc.resolve(editor.view.posAtDOM(headingNodeEl))
  } catch (error) {
    isProcessing = false
    return
  }

  if (!nodePos) return

  // if (editor.isEditable) {
  const pos = nodePos.pos
  const currentNode = tr.doc.nodeAt(pos)
  // update toc
  tr.setMeta('renderTOC', true)

  const documentId = localStorage.getItem('docId')
  const headingMap = JSON.parse(localStorage.getItem('headingMap')) || []
  const nodeState = headingMap.find((h) => h.headingId === headingId) || {
    crinkleOpen: true
  }
  const filterMode = document.body.classList.contains('filter-mode')
  let database = filterMode ? db.docFilter : db.meta

  // In filter mode, avoid saving the heading map to prevent overwriting the primary heading filter.
  if (filterMode) {
    editor.view.dispatch(tr)
    dispatchToggleHeadingSection(headingNodeEl)
    isProcessing = false
    return
  }
  database
    .put({
      docId: documentId,
      headingId,
      crinkleOpen: !nodeState.crinkleOpen,
      level: currentNode.attrs.level
    })
    .then(() => {
      database.toArray().then((data) => {
        localStorage.setItem('headingMap', JSON.stringify(data))
      })
      editor.view.dispatch(tr)
      dispatchToggleHeadingSection(headingNodeEl)
      isProcessing = false
    })
    .catch((err) => {
      console.error(err)
      isProcessing = false
    })
  // } else {
  //   isProcessing = false
  // }
}

const getNodeHLevel = (doc, pos) => {
  return doc.nodeAt(pos).attrs.level
}

const getPreviousHeadingPositions = (doc, $from, blockStartPos, currentHLevel) => {
  let prevHStartPos = 0
  let prevHEndPos = 0

  doc.nodesBetween($from.start(0), blockStartPos, (node, pos) => {
    if (pos > blockStartPos) return

    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  return { prevHStartPos, prevHEndPos }
}

const isTopLevelHeading = (currentHLevel, parentHeadingNode) => {
  return currentHLevel === 1 && parentHeadingNode.attrs.level === 1
}

// Tiptap Node
const HeadingsTitle = Node.create({
  name: ENUMS.NODES.CONTENT_HEADING_TYPE,
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
    return this.options.levels.map((level) => ({
      tag: `h${level}`,
      attrs: { level }
    }))
  },
  renderHTML(state) {
    const { node, HTMLAttributes } = state
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const level = hasLevel ? node.attrs.level : this.options.levels[0]

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        level
      }),
      0
    ]
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({}) => {
        const { editor } = this
        const { schema, selection, doc } = editor.state
        const { $anchor, from, $from } = selection

        // it mean first heading node
        if (from === 2) return

        const blockStartPos = $from.start(1) - 1
        const currentHLevel = getNodeHLevel($from.doc, blockStartPos)

        // Check if the current node is the first child of the contentWrapper
        const isFirstChild = $from.index() === 0

        // if the parent is not a content_heading node
        if ($from.parent.type.name !== ENUMS.NODES.CONTENT_HEADING_TYPE) return false

        // if the caret is not at the beginning of the content_heading node
        if ($anchor.parentOffset !== 0) return false

        return onHeading({
          backspaceAction: true,
          editor,
          state: editor.state,
          tr: editor.state.tr,
          view: editor.view
        })
      },
      Enter: () => {
        const {
          state,
          view: { dispatch }
        } = this.editor
        const { selection, doc, schema } = state
        const { $from, $to } = selection

        // Check if we're in a content heading
        if ($from.parent.type.name !== ENUMS.NODES.CONTENT_HEADING_TYPE) {
          return false
        }

        // Check if the cursor is in the middle of the node
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

        if (contentWrapper && contentWrapper.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
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
          const newParagraph = schema.nodes[ENUMS.NODES.PARAGRAPH_TYPE].create(null, afterContent)
          savedContent = savedContent
            ? newParagraph.content.append(savedContent)
            : newParagraph.content

          const newNode = schema.nodes[ENUMS.NODES.PARAGRAPH_TYPE].create(null, savedContent)

          // Insert the new node at the beginning of the content wrapper
          tr.insert(tr.mapping.map(contentWrapperPos + 1), newNode)

          // Dispatch the transaction
          dispatch(tr)
          return true
        }

        return false
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('HeadingButtons'),
        state: {
          init: (_, { doc }) => {
            PubSub.subscribe(ENUMS.EVENTS.FOLD_AND_UNFOLD, (msg, data) => {
              handleHeadingToggle(this.editor, data)
            })

            return appendButtonsDec(doc, this.editor)
          },
          apply: (tr, old) => (tr.docChanged ? appendButtonsDec(tr.doc, this.editor) : old)
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        },
        destroy() {
          PubSub.unsubscribe(ENUMS.EVENTS.FOLD_AND_UNFOLD, () => {
            console.info('destroy handleHeadingToggle')
          })
        }
      })
    ]
  }
})

export { HeadingsTitle, HeadingsTitle as default }
