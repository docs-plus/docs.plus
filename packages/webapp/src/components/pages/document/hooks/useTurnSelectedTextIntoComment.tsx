import { CHAT_COMMENT } from '@services/eventsHub'
import { Editor } from '@tiptap/core'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'

const useTurnSelectedTextIntoComment = () => {
  const createComment = useCallback((editor: Editor) => {
    const { selection } = editor.view.state

    if (selection.empty) return

    const doc = editor.state.doc
    const selPos = selection.from
    let headingId: string | null = null
    let offset = 0

    for (let i = 0; i < doc.content.childCount; i++) {
      const child = doc.content.child(i)
      if (offset + child.nodeSize > selPos) break
      if (child.type.name === 'heading') {
        headingId = child.attrs['toc-id'] as string
      }
      offset += child.nodeSize
    }

    if (!headingId) {
      const firstChild = doc.content.firstChild
      if (firstChild?.type.name === 'heading') {
        headingId = firstChild.attrs['toc-id'] as string
      }
    }

    if (!headingId) {
      console.error('[chatComment]: No headingId found')
      return
    }

    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, '\n')
    const selectedHtml = ''

    PubSub.publish(CHAT_COMMENT, {
      content: selectedText,
      html: selectedHtml,
      headingId
    })

    editor.commands.setTextSelection(selection.to)
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
