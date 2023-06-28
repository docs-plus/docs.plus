import { Selection, Plugin, TextSelection, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node, mergeAttributes } from '@tiptap/core'

import { db } from '../../../db'

import { copyToClipboard } from './helper'
import onHeading from './normalText/onHeading'

function extractContentHeadingBlocks(doc) {
  const result = []
  const record = (from, to, headingId, node) => {
    result.push({ from, to, headingId, node })
  }
  let lastHeadingId

  // For each node in the document
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === 'contentHeading') {
      const nodeSize = node.nodeSize

      record(pos, pos + nodeSize, lastHeadingId, node)
    }
  })

  return result
}

const buttonWrapper = (editor, { headingId, from, node }) => {
  const buttonWrapper = document.createElement('div')
  const btnToggleHeading = document.createElement('button')
  const btnChatBox = document.createElement('button')

  buttonWrapper.classList.add('buttonWrapper')

  btnChatBox.setAttribute('class', 'btn_openChatBox')
  btnChatBox.setAttribute('type', 'button')
  btnToggleHeading.classList.add('btnFold')
  btnToggleHeading.setAttribute('type', 'button')

  buttonWrapper.append(btnToggleHeading)
  buttonWrapper.append(btnChatBox)

  const toggleHeadingContent = (el) => {
    const headingId = el.getAttribute('data-id')
    const detailsContent = el.querySelector('div.contentWrapper')
    const event = new CustomEvent('toggleHeadingsContent', {
      detail: { headingId, el: detailsContent }
    })

    detailsContent === null || detailsContent === void 0 ? void 0 : detailsContent.dispatchEvent(event)
  }

  const foldAndUnfold = (e) => {
    const el = e.target
    const headingNodeEl = el.closest('.heading')
    let headingId = headingNodeEl.getAttribute('data-id')

    editor.commands.focus(from + node.nodeSize - 1)

    if (editor.isEditable) {
      const { tr } = editor.state
      const pos = from
      const currentNode = tr.doc.nodeAt(pos)
      const headingNode = tr.doc.nodeAt(pos - 1)

      // TODO: this is not good way
      headingId = pos === 1 ? '1' : headingId

      if (currentNode && currentNode.type.name === 'contentHeading') {
        tr.setNodeMarkup(pos, undefined, {
          ...currentNode.attrs,
          level: currentNode.attrs.level,
          id: headingNode.attrs.id
        })
      }

      if (headingNode && headingNode.type.name === 'heading') {
        tr.setNodeMarkup(pos - 1, undefined, {
          ...headingNode.attrs,
          level: currentNode.attrs.level,
          id: headingNode.attrs.id
        })
      }

      tr.setMeta('addToHistory', false)

      const documentId = localStorage.getItem('docId')
      const headingMap = JSON.parse(localStorage.getItem('headingMap')) || []
      const nodeState = headingMap.find((h) => h.headingId === headingId) || {
        crinkleOpen: true
      }

      const filterMode = document.body.classList.contains('filter-mode')

      if (!filterMode) {
        // console.log('must save data to db')
        db.meta
          .put({
            docId: documentId,
            headingId,
            crinkleOpen: !nodeState.crinkleOpen,
            level: currentNode.attrs.level
          })
          .then((data, ddd) => {
            db.meta
              .where({ docId: documentId })
              .toArray()
              .then((data) => {
                localStorage.setItem('headingMap', JSON.stringify(data))
              })
          })
      }

      editor.view.dispatch(tr)
      toggleHeadingContent(headingNodeEl)
    }
  }

  btnToggleHeading.addEventListener('click', foldAndUnfold)

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
      key: prob.headingId
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

const HeadingsTitle = Node.create({
  name: 'contentHeading',
  content: 'inline*',
  group: 'block',
  defining: true,
  // draggable: false,
  // selectable: false,
  // isolating: true,
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
      Backspace: ({ editor }) => {
        const { schema, selection, doc } = this.editor.state
        const { empty, $anchor, $head, $from, $to, from, to } = selection
        const { start, end, depth } = $from.blockRange($to)

        // current node
        const node = doc.nodeAt(from)
        // parent node
        const parent = $anchor.parent

        // if the current node is empty(means there is not content) and the parent is contentHeading
        if (
          node !== null ||
          $anchor.parentOffset !== 0 || // this node block contains content
          parent.type.name !== schema.nodes.contentHeading.name ||
          $anchor.pos === 2 // || // if the caret is in the first heading
          // parent.attrs.open === false // if the heading is closed
        )
          return false

        console.info('[Heading]: remove the heading node')

        return onHeading({
          editor,
          state: editor.state,
          tr: editor.state.tr,
          view: editor.view
        })
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('HeadingButtons'),
        state: {
          init: (_, { doc }) => appendButtonsDec(doc, this.editor),
          apply: (tr, old) => (tr.docChanged ? appendButtonsDec(tr.doc, this.editor) : old)
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

export { HeadingsTitle, HeadingsTitle as default }
