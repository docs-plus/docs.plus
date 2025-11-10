import { Extension, isTextSelection, Editor } from '@tiptap/core'
import { Plugin, PluginKey, EditorState, Selection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'
import { AddCommentMD } from '@icons'

const shouldShow = (editor: Editor): boolean => {
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

const createChatCommentButton = (view: EditorView, selection: Selection): void => {
  const button = document.createElement('button')
  button.innerHTML = AddCommentMD({ size: 22, fill: '#fff' })
  button.classList.add('chat-comment-button')
  button.addEventListener('click', () => {
    openChatComment(view.state)
  })

  const { from } = selection
  const { top: nodeTop } = view.coordsAtPos(from)

  const editorElement = view.dom.closest('.tiptap__editor') as HTMLElement
  const { top: editorTop, width: editorWidth } = editorElement.getBoundingClientRect()

  const offsetTop = nodeTop - editorTop

  // Get the current node element height
  const node = view.nodeDOM(from) as HTMLElement
  const nodeHeight = node ? node.offsetHeight : 0

  // Adjust the button position to be centered vertically relative to the node
  const adjustedTop = nodeHeight ? offsetTop + nodeHeight / 2 - 16 : offsetTop - 16

  const isInContentHeading = selection.$anchor.parent.type.name === 'contentHeading'

  button.style.position = 'absolute'

  if (isInContentHeading) {
    // For content headings, position from the right edge with a fixed offset
    button.style.right = 'auto'

    // Position 60px from the right edge of the editor
    const rightOffset = 60
    button.style.left = `${editorWidth - rightOffset - 50}px`
  } else {
    button.style.right = '9px'
  }

  button.style.top = `${Math.round(adjustedTop)}px`

  button.classList.add(
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md',
    'z-1'
  )

  view.dom.parentNode!.appendChild(button)
}

const openChatComment = (state: EditorState): void => {
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
            keydown: (view: EditorView, event: KeyboardEvent) => {
              //  keyCode 77 is for m key
              if (event.keyCode === 77 && event.altKey && event.metaKey) {
                event.preventDefault()
                openChatComment(view.state)
              }
              return false
            },
            mouseup: (view: EditorView, event: MouseEvent) => {
              const state = this.editor.state

              if (shouldShow(this.editor)) {
                createChatCommentButton(view, state.selection)
              } else {
                const button = view.dom.parentNode!.querySelector('.chat-comment-button')
                if (button) {
                  button.remove()
                }
              }

              return true
            },
            mousedown: (view: EditorView, event: MouseEvent) => {
              const button = view.dom.parentNode!.querySelector('.chat-comment-button')
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
