/**
 * Generates a random string with a given prefix.
 *
 * @param prefix - The prefix for the generated string.
 * @returns A random string prefixed with the given prefix.
 */
export const randstr = (prefix: string = ''): string => {
  return Math.random().toString(36).replace('0.', prefix)
}

/**
 * Copies a given text to the clipboard.
 *
 * Uses the Clipboard API when available, falling back to document.execCommand('copy') if not.
 * Returns true if successful, false if not.
 *
 * @param text - The text to be copied to the clipboard.
 * @returns A boolean indicating whether the operation was successful.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.error('Error copying text: ', err)
      return false
    }
  } else {
    // Clipboard API not available, fallback to older method
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      const successful = document.execCommand('copy')
      const msg = successful ? 'successful' : 'unsuccessful'
      console.info('Fallback: Copying text command was ' + msg)
      document.body.removeChild(textArea)
      return successful
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err)
      document.body.removeChild(textArea)
      return false
    }
  }
}

//
export const getPostAtDOM = (editor: any, id: string = '1') => {
  const heading = document.querySelector(`.heading[data-id="${id}"]`)
  if (!heading) return -1
  return editor?.view?.posAtDOM(heading, 0)
}

export * from './twx'
export * from './emojis'
export * from './chunkHtmlContent'
export * from './groupMessages'
export * from './scrollToHeading'
export * from './request'
