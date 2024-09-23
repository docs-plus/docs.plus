import { Extension, isTextSelection } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'
import { AddCommentMD } from '@icons'

const shouldShow = (editor) => {
  const state = editor.state
  const view = editor.view
  const { from, to } = state.selection
  const { doc, selection } = state
  const { empty } = selection

  // Sometime check for `empty` is not enough.
  // Doubleclick an empty paragraph returns a node size of 2.
  // So we check also for an empty text size.
  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(state.selection)

  const hasEditorFocus = view.hasFocus()

  if (!hasEditorFocus || empty || isEmptyTextBlock || !editor.isEditable) {
    return false
  }

  return true
}

const createChatCommentButton = (view, selection) => {
  const button = document.createElement('button')
  button.innerHTML = AddCommentMD({ size: 22, fill: '#fff' })
  button.classList.add('chat-comment-button')
  button.addEventListener('click', () => {
    openChatComment(view.state)
  })

  const { from } = selection
  const { top: nodeTop } = view.coordsAtPos(from)

  const editorElement = view.dom.closest('.tiptap__editor')
  const { top: editorTop } = editorElement.getBoundingClientRect()

  const offsetTop = nodeTop - editorTop

  // Get the current node element height
  const node = view.nodeDOM(from)
  const nodeHeight = node ? node.offsetHeight : 0

  // Adjust the button position to be centered vertically relative to the node
  const adjustedTop = nodeHeight ? offsetTop + nodeHeight / 2 - 16 : offsetTop - 16

  button.style.position = 'absolute'
  button.style.right = '12px'
  button.style.top = `${Math.round(adjustedTop)}px`

  button.classList.add('btn', 'btn-circle', 'btn-primary', 'size-10', 'min-h-10')

  view.dom.parentNode.appendChild(button)
}

const openChatComment = (state) => {
  const { selection } = state

  // if no selection, do nothing
  if (selection.empty) return
  // TODO: check for higher heading node
  let headingNode = null
  let depth = selection.$from.depth
  while (depth > 0) {
    const node = selection.$from.node(depth)
    if (node.type.name.startsWith('heading')) {
      headingNode = node
      break
    }
    depth--
  }
  const headingId = headingNode?.attrs.id

  if (!headingId) {
    console.error('[chatComment]: No headingId found')
    return
  }

  const selectedText = state.doc.textBetween(selection.from, selection.to, '\n')
  const selectedHtml = '' //view.dom.innerHTML.slice(selection.from, selection.to)

  PubSub.publish(CHAT_COMMENT, {
    content: selectedText,
    html: selectedHtml,
    headingId
  })
}

const ChatCommentExtension = Extension.create({
  name: 'chatComment',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('chatComment'),
        props: {
          handleDOMEvents: {
            keydown: (view, event) => {
              //  keyCode 77 is for m key
              if (event.keyCode === 77 && event.altKey && event.metaKey) {
                event.preventDefault()
                openChatComment(view.state)
              }
              return false
            },
            mouseup: (view, event) => {
              const state = this.editor.state

              if (shouldShow(this.editor)) {
                createChatCommentButton(view, state.selection)
              } else {
                const button = view.dom.parentNode.querySelector('.chat-comment-button')
                if (button) {
                  button.remove()
                }
              }

              return true
            },
            mousedown: (view, event) => {
              const button = view.dom.parentNode.querySelector('.chat-comment-button')
              if (button) {
                button.remove()
              }
              return true
            }
          }
        }
      })
    ]
  }
})

export default ChatCommentExtension
