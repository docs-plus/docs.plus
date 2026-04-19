export const copyToClipboard = async (
  text: string,
  callback?: (success: boolean) => void
): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
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
