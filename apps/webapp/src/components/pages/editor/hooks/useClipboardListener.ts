import { useEffect } from 'react'

export const useClipboardListener = () => {
  useEffect(() => {
    const handleCopy = async () => {
      // Copy fires before the write lands; 100ms lets read() see it.
      setTimeout(async () => {
        try {
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
