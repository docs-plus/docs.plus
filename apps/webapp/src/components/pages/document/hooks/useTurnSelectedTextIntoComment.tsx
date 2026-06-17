import { buildTextCommentAnchorFromEditor, publishDocumentComment } from '@services/commentAnchor'
import { Editor } from '@tiptap/core'
import { useCallback } from 'react'

const useTurnSelectedTextIntoComment = () => {
  const createComment = useCallback((editor: Editor) => {
    const anchor = buildTextCommentAnchorFromEditor(editor)
    if (!anchor) {
      console.error('[chatComment]: No headingId found')
      return
    }

    publishDocumentComment(anchor)

    editor.commands.setTextSelection(editor.state.selection.to)
    editor.commands.scrollIntoView()

    const selectionEl = window.getSelection()?.anchorNode?.parentElement as HTMLElement | null
    selectionEl?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    })
  }, [])

  return { createComment }
}

export default useTurnSelectedTextIntoComment
