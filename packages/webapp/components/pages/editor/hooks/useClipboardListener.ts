import { useEffect } from 'react'

// Custom hook to listen for clipboard events
export const useClipboardListener = () => {
  useEffect(() => {
    const handleCopy = async () => {
      // Small delay to allow the clipboard to update
      setTimeout(async () => {
        try {
          // Try to read HTML content using paste event
          const clipboardData = await navigator.clipboard.read()
          for (const item of clipboardData) {
            if (item.types.includes('text/html')) {
              const blob = await item.getType('text/html')
              const html = await blob.text()
              console.log('Clipboard HTML content =>', html)
            }
          }
        } catch (error) {
          console.error('Failed to read clipboard =>', error)
        }
      }, 100)
    }

    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('copy', handleCopy)
    }
  }, [])
}
