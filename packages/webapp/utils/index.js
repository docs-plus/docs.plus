/**
 * @param {string} prefix
 * @returns {string}
 */
export const randstr = (prefix) => {
  return Math.random()
    .toString(36)
    .replace('0.', prefix || '')
}
/**
 * Copies a given text to the clipboard.
 *
 * Uses the Clipboard API when available, falling back to document.execCommand('copy') if not.
 * Returns true if successful, false if not.
 *
 * @param {string} text - The text to be copied to the clipboard.
 * @returns {boolean} - A boolean indicating whether the operation was successful.
 */
export const copyToClipboard = (text) => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch((err) => {
        console.error('Error copying text: ', err)
        return false
      })
  } else {
    // Clipboard API not available, fallback to older method
    var textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      var successful = document.execCommand('copy')
      var msg = successful ? 'successful' : 'unsuccessful'
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
