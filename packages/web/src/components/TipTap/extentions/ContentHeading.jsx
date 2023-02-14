import { Selection, Plugin, TextSelection, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node, mergeAttributes } from '@tiptap/core'

import joinH1ToPrevHeading from './joinH1ToPrevHeading'
import { copyToClipboard } from './helper'

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
    const detailsContent = document.querySelector(`.heading[data-id="${headingId}"] div.contentWrapper`)
    const event = new CustomEvent('toggleHeadingsContent', { detail: { headingId, open, el: detailsContent } })

    detailsContent === null || detailsContent === void 0 ? void 0 : detailsContent.dispatchEvent(event)
  }

  const foldAndUnfold = (e) => {
    const el = e.target

    editor.commands.focus(from + node.nodeSize - 1)
    if (editor.isEditable) {
      editor
        .chain()
        .command(({ tr }) => {
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

          return true
        })
        .run()

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
  content: 'text*',
  group: 'block',
  defining: true,
  draggable: false,
  selectable: false,
  isolating: true,
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
    return [
      {
        tag: `div[data-type="${this.name}"]`
      }
    ]
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
      Backspace: (data) => {
        const { schema, selection, doc } = this.editor.state
        const { empty, $anchor, $head, $from, $to } = selection
        const { depth } = $anchor

        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false

        // TODO: if the backspace is in heading level 1
        // TODO: what if there is not parent

        // if Backspace is in the contentHeading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          const heading = $head.path.filter(x => x?.type?.name)
            .findLast(x => x.type.name === 'heading')
          const contentWrapper = heading.lastChild

          console.log({
            $anchor,
            contentWrapper,
            heading,
            parent: !$from.doc.nodeAt($from.pos - 2).attrs.open,
            r: heading.lastChild?.attrs,
            re: Object.hasOwn(heading.lastChild?.attrs, 'open'),
            w: !$from.doc.nodeAt($from.pos - 2).attrs.open
          })

          // check if the current heading has level 1
          // then if has h1 sebling as prev block
          if ($anchor.parent.type.name === 'contentHeading' && $anchor.parent.attrs.level === 1) {
            return joinH1ToPrevHeading(this.editor)
          }

          // INFO: Prevent To Remove the Heading Block If its close.
          if (Object.hasOwn(heading.lastChild?.attrs, 'open') && !heading.lastChild?.attrs?.open) return false

          // if (heading.lastChild.type.name === heading.firstChild.type.name) {

          // }

          // INFO: CURRENT pos start, with size of first paragraph in the contentWrapper
          const block = {
            start: $from.start(depth - 1) - 1,
            end: $from.end(depth - 1)
          }

          // console.log({
          //   heading
          // })

          const selectionPos = block.start + 1 + (heading.lastChild?.firstChild?.content?.size || -1)

          console.log({
            selectionPos,
            block,
            contentWrapper,
            parent: $from.doc.nodeAt($from.start(depth) - 3)
          })

          return this.editor.chain()
            .insertContentAt(
              { from: block.start, to: block.end },
              contentWrapper.content.toJSON()
            )
            .setTextSelection(selectionPos)
            .scrollIntoView()
            .run()
        }
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
