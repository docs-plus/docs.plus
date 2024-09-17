import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'
import { AddCommentMD } from '@icons'

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
  const adjustedTop = offsetTop + nodeHeight / 2 - 16

  button.style.position = 'absolute'
  button.style.right = '12px'
  button.style.top = `${Math.round(adjustedTop)}px`

  button.classList.add('btn', 'btn-circle', 'btn-primary', 'size-10')

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
              const { selection } = view.state
              if (!selection.empty) {
                createChatCommentButton(view, selection)
              }
              return false
            },
            mousedown: (view, event) => {
              const button = view.dom.parentNode.querySelector('.chat-comment-button')
              if (button) {
                button.remove()
              }
              return false
            }
          }
        }
      })
    ]
  }
})

export default ChatCommentExtension
