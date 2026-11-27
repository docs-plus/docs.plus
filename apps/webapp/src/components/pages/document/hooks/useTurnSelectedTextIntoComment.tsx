import { canCommentInDocument } from '@hooks/isDocumentEditingLocked'
import { buildTextCommentAnchorFromEditor, publishDocumentComment } from '@services/commentAnchor'
import { Editor } from '@tiptap/core'
import { useCallback } from 'react'

const useTurnSelectedTextIntoComment = () => {
  const createComment = useCallback((editor: Editor) => {
    if (!canCommentInDocument()) return

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
