import { useCallback } from 'react'
import { Editor } from '@tiptap/react'
import * as toast from '@components/toast'

const useCopyDocumentToClipboard = (editor: Editor | null) => {
  const copyDocumentToClipboard = useCallback(async () => {
    if (!editor) return

    try {
      const htmlContent = editor.getHTML()
      const textContent = editor.getText()

      // Try to copy as both HTML and plain text
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([textContent], { type: 'text/plain' })
          })
        ])
      } else {
        // Fallback to plain text only
        await navigator.clipboard.writeText(textContent)
      }

      toast.Success('Document copied to clipboard')
    } catch (error) {
      console.error('Failed to copy document to clipboard:', error)
      // Fallback: try to select all and copy
      editor.commands.selectAll()
      document.execCommand('copy')
    }
  }, [editor])

  return { copyDocumentToClipboard }
}

export default useCopyDocumentToClipboard
