import DOMPurify from 'dompurify'

const MESSAGE_HTML_PURIFY = {
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
    'pre',
    'span'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel']
}

const TRAILING_EMPTY_P = /<p><\/p>$|<p\s*\/>$/g

const escapeHtmlText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const purifyMessageHtml = (html: string) =>
  DOMPurify.sanitize(html, MESSAGE_HTML_PURIFY).replace(TRAILING_EMPTY_P, '')

const sanitizePlainText = (text: string, maxLen: number) =>
  text.replace(/[<>]/g, '').substring(0, maxLen).trim()

/** Legacy rows: autolink plain `messages.content` when `html` is absent. */
export const linkifyPlainMessageHtml = (text: string) =>
  escapeHtmlText(text).replace(
    /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi,
    '<a href="$1" rel="noopener noreferrer nofollow">$1</a>'
  )

export const sanitizeMessageContent = (html: string, text: string) => ({
  sanitizedHtml: purifyMessageHtml(html),
  sanitizedText: sanitizePlainText(text, 10000)
})

export const sanitizeChunk = (htmlChunk: string, textChunk: string) => ({
  sanitizedHtmlChunk: purifyMessageHtml(htmlChunk),
  sanitizedTextChunk: sanitizePlainText(textChunk, 3000)
})

/** Feed/card HTML: stored TipTap `html` or legacy linkified plain text. */
export function getSanitizedMessageBodyHtml(
  storedHtml: string | undefined | null,
  plain: string
): string {
  const text = plain || ''
  const trimmed = storedHtml?.trim()
  const htmlInput = trimmed ? trimmed : linkifyPlainMessageHtml(text)
  const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(htmlInput, text)
  return sanitizedHtml || sanitizedText || ''
}
