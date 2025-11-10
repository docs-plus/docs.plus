import { useCallback } from 'react'
import { Editor } from '@tiptap/core'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'

const useTurnSelectedTextIntoComment = () => {
  const createComment = useCallback((editor: Editor) => {
    const { selection } = editor.view.state

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

    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, '\n')
    const selectedHtml = '' //editor.view.dom.innerHTML.slice(selection.from, selection.to)

    PubSub.publish(CHAT_COMMENT, {
      content: selectedText,
      html: selectedHtml,
      headingId
    })

    // Deselect the text after creating the comment
    editor.commands.setTextSelection(selection.to)

    // scroll the document to the top of the page
    editor.commands.scrollIntoView()

    const WindowsSelection = window?.getSelection()?.anchorNode?.parentElement as HTMLElement | null
    if (WindowsSelection) {
      WindowsSelection.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      })
    }
  }, [])

  return { createComment }
}

export default useTurnSelectedTextIntoComment
