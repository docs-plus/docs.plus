import { logger } from './logger'

/**
 * The single source of truth for clipboard writes. React components should use
 * the `useCopyToClipboard` hook instead of calling this directly.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      logger.debug('Clipboard API failed', { error: err })
    }
  }

  return copyToClipboardLegacy(text)
}

/** @internal execCommand path for browsers without the Clipboard API. */
const copyToClipboardLegacy = (text: string): boolean => {
  const textArea = document.createElement('textarea')
  textArea.value = text

  // Off-screen rather than hidden: `display: none` would break `select()`.
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

/** Writes both flavours so a paste target can keep the formatting. */
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
    return copyToClipboard(plainText)
  } catch (err) {
    logger.debug('Rich clipboard copy failed', { error: err })
    return copyToClipboard(plainText)
  }
}
