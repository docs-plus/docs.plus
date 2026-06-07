/**
 *
 * This hook registers keyboard shortcuts for copy/paste operations and
 * exposes functions to programmatically trigger copy/paste actions.
 *
 * It accomplishes three key tasks:
 * 1. Listens for keyboard shortcuts (Cmd/Ctrl+C, Cmd/Ctrl+V)
 * 2. Triggers the corresponding buttons in the DOM
 * 3. Exposes global triggers via window for testing frameworks
 * */

import { useEffect } from 'react'

export const useClipboardShortcuts = () => {
  // Function to programmatically trigger the copy button
  const triggerCopyButton = () => {
    document.getElementById('btn_copyselectedcontent')?.click()
  }

  // Function to programmatically trigger the paste button
  const triggerPasteButton = () => {
    document.getElementById('btn_pastefromclipboard')?.click()
  }

  // Add keyboard shortcut listeners for both Copy and Paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd+C (Mac) or Ctrl+C (Windows) is pressed
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Let the default copy happen, but also trigger our button
        setTimeout(() => triggerCopyButton(), 0)
      }

      // Check if Cmd+V (Mac) or Ctrl+V (Windows) is pressed
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        // Let the default paste happen, but also trigger our button
        setTimeout(() => triggerPasteButton(), 0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Expose both trigger functions to window for external access
  useEffect(() => {
    // @ts-ignore
    window._triggerCopy = triggerCopyButton
    // @ts-ignore
    window._triggerPaste = triggerPasteButton
  }, [])
}
