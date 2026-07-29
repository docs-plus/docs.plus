/**
 * Routes Cmd/Ctrl+C and +V through the Controllers buttons, and exposes the same triggers on
 * `window` so test frameworks can fire them without synthesising key events.
 */

import { useEffect } from 'react'

export const useClipboardShortcuts = () => {
  const triggerCopyButton = () => {
    document.getElementById('btn_copyselectedcontent')?.click()
  }

  const triggerPasteButton = () => {
    document.getElementById('btn_pastefromclipboard')?.click()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Let the default copy happen, but also trigger our button
        setTimeout(() => triggerCopyButton(), 0)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        // Let the default paste happen, but also trigger our button
        setTimeout(() => triggerPasteButton(), 0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    // @ts-ignore
    window._triggerCopy = triggerCopyButton
    // @ts-ignore
    window._triggerPaste = triggerPasteButton
  }, [])
}
