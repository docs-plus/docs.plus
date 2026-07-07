import { logger } from './logger'

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
      let ok = false
      try {
        textArea.select()
        ok = document.execCommand('copy')
      } finally {
        document.body.removeChild(textArea)
      }
      if (!ok) {
        logger.warn('copyToClipboard failed', 'execCommand returned false')
        callback?.(false)
        return false
      }
    }

    callback?.(true)
    return true
  } catch (error) {
    logger.warn('copyToClipboard failed', error)
    callback?.(false)
    return false
  }
}
