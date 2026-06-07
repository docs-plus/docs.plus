import { logger } from './logger'

/**
 * Copy text to clipboard with fallback for older browsers.
 *
 * This is the single source of truth for clipboard operations in the app.
 * For React components, use the `useCopyToClipboard` hook instead.
 *
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if successful, false otherwise
 *
 * @example
 * // Basic usage
 * const success = await copyToClipboard('Hello World')
 *
 * @example
 * // With error handling
 * if (await copyToClipboard(url)) {
 *   toast.Success('Link copied!')
 * }
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      logger.debug('Clipboard API failed', { error: err })
      // Fall through to legacy method
    }
  }

  // Fallback for older browsers or when Clipboard API fails
  return copyToClipboardLegacy(text)
}

/**
 * Legacy clipboard copy using execCommand (for older browsers).
 * @internal
 */
const copyToClipboardLegacy = (text: string): boolean => {
  const textArea = document.createElement('textarea')
  textArea.value = text

  // Make textarea invisible but still functional
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  textArea.style.top = '-9999px'
  textArea.style.opacity = '0'

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    logger.debug('Legacy clipboard copy failed', { error: err })
    document.body.removeChild(textArea)
    return false
  }
}

/**
 * Copy rich content (HTML + plain text) to clipboard.
 * Used for copying formatted content that should preserve styling when pasted.
 *
 * @param html - HTML content
 * @param plainText - Plain text fallback
 * @returns Promise<boolean> - true if successful
 */
export const copyRichContentToClipboard = async (
  html: string,
  plainText: string
): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ])
      return true
    }
    // Fallback to plain text
    return copyToClipboard(plainText)
  } catch (err) {
    logger.debug('Rich clipboard copy failed', { error: err })
    // Fallback to plain text
    return copyToClipboard(plainText)
  }
}
