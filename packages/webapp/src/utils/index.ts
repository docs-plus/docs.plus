/**
 * Generates a random string with a given prefix.
 *
 * @param prefix - The prefix for the generated string.
 * @returns A random string prefixed with the given prefix.
 */
export const randstr = (prefix: string = ''): string => {
  return Math.random().toString(36).replace('0.', prefix)
}

// Re-export clipboard utilities from dedicated module
export { copyToClipboard, copyRichContentToClipboard } from './clipboard'

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
export * from './sanitizeContent'
export * from './retryWithBackoff'
export * from './logger'
export * from './metadata'
