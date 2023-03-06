import { Selection, Plugin, TextSelection, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node, mergeAttributes } from '@tiptap/core'

import { copyToClipboard } from './helper'
import onHeading from './normalText/onHeading'

function extractContentHeadingBlocks (doc) {
  const result = []
  const record = (from, to, open, headingId, node) => {
    result.push({ from, to, open, headingId, node })
  }
  let lastHeadingId

  // For each node in the document
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === 'contentHeading') {
      const nodeSize = node.nodeSize

      record(pos, pos + nodeSize, node.attrs.open, lastHeadingId, node)
    }
  })

  return result
}

const buttonWrapper = (editor, { headingId, open, from, node }) => {
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
    let detailsContent = document.querySelector(`.heading[data-id="${headingId}"] div.contentWrapper`)

    // FIXME: this is a temporary solution
    if (!detailsContent) {
      headingId = 1
      detailsContent = document.querySelector(`.heading[data-id="${headingId}"] div.contentWrapper`)
    }

    const event = new CustomEvent('toggleHeadingsContent', { detail: { headingId, open, el: detailsContent } })

    detailsContent === null || detailsContent === void 0 ? void 0 : detailsContent.dispatchEvent(event)
  }

  const foldAndUnfold = (e) => {
    const el = e.target

    editor.commands.focus(from + node.nodeSize - 1)
    if (editor.isEditable) {
      const { tr } = editor.state
      const pos = from
      const currentNode = tr.doc.nodeAt(pos)
      const headingNode = tr.doc.nodeAt(pos - 1)

      // if (currentNode.type.name !== 'contentHeading') {
      //   return false
      // }

      tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        open: !currentNode.attrs.open,
        level: currentNode.attrs.level
      }).setNodeMarkup(pos - 1, undefined, {
        ...headingNode.attrs,
        open: !currentNode.attrs.open,
        level: currentNode.attrs.level
      })

      tr.setMeta('addToHistory', false)

      toggleHeadingContent(el)
    }
  }

  btnToggleHeading.addEventListener('click', foldAndUnfold)

  // copy the link to clipboard
  const href = document.createElement('a')

  href.innerHTML = '#'
  href.setAttribute('href', `#${headingId}`)
  href.addEventListener('click', (e) => {
    e.preventDefault()
    const url = new URL(window.location)

    url.searchParams.set('id', headingId)
    window.history.pushState({}, '', url)
    copyToClipboard(url)
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

  contentWrappers.forEach(prob => {
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
  addOptions () {
    return {
      open: true,
      HTMLAttributes: {
        class: 'title'
      },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    }
  },
  addAttributes () {
    return {
      open: {
        default: true
      },
      level: {
        default: 1,
        rendered: false
      }
    }
  },
  parseHTML () {
    return this.options.levels
      .map((level) => ({
        tag: `h${level}`,
        attrs: { level }
      }))
  },
  renderHTML (state) {
    const { node, HTMLAttributes } = state
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0]

    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, { ...HTMLAttributes, level }), 0]
  },
  addKeyboardShortcuts () {
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
          (node !== null || $anchor.parentOffset !== 0) || // this node block contains content
          parent.type.name !== schema.nodes.contentHeading.name ||
          $anchor.pos === 2 || // if the caret is in the first heading
          parent.attrs.open === false // if the heading is closed
        ) return false

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
  addProseMirrorPlugins () {
    return [
      new Plugin({
        key: new PluginKey('HeadingButtons'),
        state: {
          init: (_, { doc }) => appendButtonsDec(doc, this.editor),
          apply: (tr, old) => tr.docChanged ? appendButtonsDec(tr.doc, this.editor) : old
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

export { HeadingsTitle, HeadingsTitle as default }
