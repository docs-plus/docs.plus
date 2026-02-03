import * as toast from '@components/toast'
import { Editor } from '@tiptap/react'
import { copyRichContentToClipboard, copyToClipboard } from '@utils/clipboard'
import { useCallback, useRef, useState } from 'react'

/**
 * Hook for copying the entire document content to clipboard.
 * Preserves HTML formatting when possible.
 * Returns copied state for visual feedback.
 */
const useCopyDocumentToClipboard = (editor: Editor | null) => {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const copyDocumentToClipboard = useCallback(async () => {
    if (!editor) return

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    try {
      const htmlContent = editor.getHTML()
      const textContent = editor.getText()

      // Try to copy as both HTML and plain text using shared utility
      const success = await copyRichContentToClipboard(htmlContent, textContent)

      if (success) {
        setCopied(true)
      } else {
        // Fallback: try to select all and copy via execCommand
        editor.commands.selectAll()
        document.execCommand('copy')
        setCopied(true)
      }

      // Reset copied state after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy document to clipboard:', error)
      // Last resort fallback
      try {
        const textContent = editor.getText()
        await copyToClipboard(textContent)
        setCopied(true)
        timeoutRef.current = setTimeout(() => {
          setCopied(false)
        }, 2000)
      } catch {
        toast.Error('Failed to copy document')
      }
    }
  }, [editor])

  return { copyDocumentToClipboard, copied }
}

export default useCopyDocumentToClipboard
