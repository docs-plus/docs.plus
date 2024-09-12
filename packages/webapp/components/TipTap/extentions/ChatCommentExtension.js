import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'

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
            }
          }
        }
      })
    ]
  }
})

export default ChatCommentExtension
