export const copyToClipboard = async (
  text: string,
  callback?: (success: boolean) => void
): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for older browsers or non-HTTPS contexts
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }

    callback?.(true)
    return true
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error)
    callback?.(false)
    return false
  }
}

/*
// Usage Examples:

// Basic usage - just copy text
await copyToClipboard('Hello world!')

// With success/error feedback
copyToClipboard('https://example.com', (success) => {
  if (success) {
    showToast('Link copied to clipboard!', 'success')
  } else {
    showToast('Failed to copy link', 'error')
  }
})

// Check return value and use callback
const success = await copyToClipboard('some text', (success) => {
  updateCopyButton(success ? 'Copied!' : 'Failed')
})

if (success) {
  // Additional success logic
  console.log('Copy operation succeeded')
}

// Shorthand callback
copyToClipboard('text', (success) =>
  success ? setStatus('copied') : setStatus('error')
)
*/
