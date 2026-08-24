import * as toast from '@components/toast'
import { Editor } from '@tiptap/react'
import { copyRichContentToClipboard, copyToClipboard } from '@utils/clipboard'
import { useCallback, useRef, useState } from 'react'

const useCopyDocumentToClipboard = (editor: Editor | null) => {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const copyDocumentToClipboard = useCallback(async () => {
    if (!editor) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    try {
      const htmlContent = editor.getHTML()
      const textContent = editor.getText()

      const success = await copyRichContentToClipboard(htmlContent, textContent)

      if (success) {
        setCopied(true)
      } else {
        editor.commands.selectAll()
        document.execCommand('copy')
        setCopied(true)
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy document to clipboard:', error)
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
