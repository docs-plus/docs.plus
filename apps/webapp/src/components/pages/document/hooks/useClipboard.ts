import { Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'

interface UseClipboardReturn {
  cut: () => void
  copy: () => void
  paste: () => void
  copied: boolean
}

/**
 * Mirrors native mobile behavior: cut and copy dismiss the bubble menu and the keyboard,
 * paste keeps the keyboard open so editing continues.
 */
const useClipboard = (editor: Editor | null | undefined): UseClipboardReturn => {
  const [copied, setCopied] = useState(false)

  const dismissMenuAndKeyboard = useCallback(() => {
    if (!editor) return

    const { to } = editor.state.selection
    editor.chain().setTextSelection(to).run()

    setTimeout(() => {
      editor.view.dom.blur()
    }, 50)
  }, [editor])

  const cut = useCallback(() => {
    if (!editor) return

    try {
      // execCommand('cut') preserves rich text formatting
      const success = document.execCommand('cut')
      if (!success) {
        // Fallback: manual cut via Clipboard API (plain text only)
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')
        navigator.clipboard.writeText(text).catch(() => {})
        editor.chain().deleteSelection().run()
      }

      dismissMenuAndKeyboard()
    } catch {
      editor.chain().deleteSelection().run()
      dismissMenuAndKeyboard()
    }
  }, [editor, dismissMenuAndKeyboard])

  const copy = useCallback(() => {
    if (!editor) return

    try {
      // execCommand('copy') preserves rich text formatting
      const success = document.execCommand('copy')
      if (!success) {
        // Fallback: Clipboard API (plain text only)
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')
        navigator.clipboard.writeText(text).catch(() => {})
      }

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
        editor.view.dom.blur()
      }, 600)
    } catch {
      // clipboard API unavailable — menu still closes
    }
  }, [editor])

  const paste = useCallback(() => {
    if (!editor) return

    const editorWrapper = editor.view.dom.closest('.editorWrapper') as HTMLElement
    const scrollTop = editorWrapper?.scrollTop ?? 0

    editor.commands.focus()

    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) {
          editor.commands.insertContent(text)
        }
      })
      .catch(() => {
        // Clipboard denied - try execCommand as last resort
        document.execCommand('paste')
      })
      .finally(() => {
        requestAnimationFrame(() => {
          if (editorWrapper) editorWrapper.scrollTop = scrollTop
        })
      })
  }, [editor])

  return { cut, copy, paste, copied }
}

export default useClipboard
