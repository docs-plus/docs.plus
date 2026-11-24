import { isSafeHref } from '@docs.plus/extension-hyperlink'
import type { JSONContent } from '@tiptap/core'
import DOMPurify from 'dompurify'

import { escapeHtml } from './escapeHtml'

const MESSAGE_HTML_PURIFY = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
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

const purifyMessageHtml = (html: string) =>
  DOMPurify.sanitize(html, MESSAGE_HTML_PURIFY).replace(TRAILING_EMPTY_P, '')

const sanitizePlainText = (text: string, maxLen: number) =>
  text.replace(/[<>]/g, '').substring(0, maxLen).trim()

/** Legacy rows: autolink plain `messages.content` when `html` is absent. */
export const linkifyPlainMessageHtml = (text: string) =>
  escapeHtml(text).replace(
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

/** Pele's root SVG carries `role`; the svg profile allows it for HTML only. */
export const sanitizeDiagramSvg = (svg: string): Node =>
  DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    ADD_ATTR: ['role'],
    FORBID_TAGS: ['style', 'a', 'image', 'use'],
    FORBID_ATTR: ['href', 'xlink:href'],
    RETURN_DOM_FRAGMENT: true
  })

const SAFE_DATA_IMAGE_RE = /^data:image\/(?!svg\+xml)/i
// eslint-disable-next-line no-control-regex
const INVISIBLE_OR_CONTROL_RE = /[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]/g

const cleanUrl = (value: string): string => value.replace(INVISIBLE_OR_CONTROL_RE, '').trim()

const sanitizeLinkHref = (href: string): string | null => {
  const cleaned = cleanUrl(href)
  return isSafeHref(cleaned) ? cleaned : null
}

const sanitizeMediaSrc = (src: string): string | null => {
  const cleaned = cleanUrl(src)
  if (!cleaned) return null
  if (isSafeHref(cleaned) || SAFE_DATA_IMAGE_RE.test(cleaned)) return cleaned
  return null
}

/**
 * Scrubs dangerous `href` / `src` values and strips unsafe link marks from TipTap JSONContent.
 * Used by Markdown paste and imported document replacement.
 */
export function sanitizeJsonContent(node: JSONContent): JSONContent {
  const result: JSONContent = { ...node }

  if (result.attrs) {
    const attrs = { ...result.attrs }
    if (typeof attrs.href === 'string') {
      const safeHref = sanitizeLinkHref(attrs.href)
      if (safeHref) attrs.href = safeHref
      else delete attrs.href
    }
    if (typeof attrs.src === 'string') {
      const safeSrc = sanitizeMediaSrc(attrs.src)
      if (safeSrc) attrs.src = safeSrc
      else delete attrs.src
    }
    result.attrs = attrs
  }

  if (Array.isArray(result.marks)) {
    const sanitizedMarks = result.marks.flatMap((mark) => {
      const isLinkMark = mark.type === 'hyperlink' || mark.type === 'link'
      const rawHref = typeof mark.attrs?.href === 'string' ? mark.attrs.href : null
      if (!isLinkMark && rawHref === null) return [mark]

      const safeHref = rawHref ? sanitizeLinkHref(rawHref) : null
      if (!safeHref) return []

      return [{ ...mark, attrs: { ...mark.attrs, href: safeHref } }]
    })
    if (sanitizedMarks.length > 0) {
      result.marks = sanitizedMarks
    } else {
      delete result.marks
    }
  }

  if (result.content) {
    result.content = result.content.map(sanitizeJsonContent)
  }

  return result
}
