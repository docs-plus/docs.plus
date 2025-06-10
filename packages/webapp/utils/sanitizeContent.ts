import DOMPurify from 'dompurify'

/**
 * Sanitize message content to prevent XSS and injection attacks
 * @param html - The HTML content to sanitize
 * @param text - The text content to sanitize
 * @returns Object containing sanitized HTML and text
 */
export const sanitizeMessageContent = (html: string, text: string) => {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  }).replace(/<p><\/p>$|<p\s*\/>$/g, '') // Remove empty p tags at the end

  const sanitizedText = text
    .replace(/[<>]/g, '') // Remove potential HTML tags from text
    .substring(0, 10000) // Limit text length
    .trim()

  return { sanitizedHtml, sanitizedText }
}

/**
 * Sanitize individual message chunks to prevent XSS and injection attacks
 * @param htmlChunk - The HTML chunk to sanitize
 * @param textChunk - The text chunk to sanitize
 * @returns Object containing sanitized HTML and text chunks
 */
export const sanitizeChunk = (htmlChunk: string, textChunk: string) => {
  const sanitizedHtmlChunk = DOMPurify.sanitize(htmlChunk, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  }).replace(/<p><\/p>$|<p\s*\/>$/g, '') // Remove empty p tags at the end
  const sanitizedTextChunk = textChunk.replace(/[<>]/g, '').substring(0, 3000).trim()

  return { sanitizedHtmlChunk, sanitizedTextChunk }
}
