import type { Editor, JSONContent } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { logger } from '@utils/logger'

const MAX_CLIPBOARD_SIZE = 500_000

const SAFE_PROTOCOLS = /^(?:https?|ftp|mailto|tel|sms):/i

function sanitizeHref(href: string): string | null {
  const cleaned = href.replace(/[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]/g, '').trim()
  if (!cleaned) return null

  const colonIdx = cleaned.indexOf(':')
  if (colonIdx === -1) return cleaned

  const slashIdx = cleaned.indexOf('/')
  if (slashIdx !== -1 && slashIdx < colonIdx) return cleaned

  if (SAFE_PROTOCOLS.test(cleaned)) return cleaned
  if (/^data:image\/(?!svg\+xml)/i.test(cleaned)) return cleaned
  return null
}

export function sanitizeJsonContent(node: JSONContent): JSONContent {
  const result = { ...node }

  if (result.attrs) {
    const attrs = { ...result.attrs }
    if (typeof attrs.href === 'string') attrs.href = sanitizeHref(attrs.href) ?? ''
    if (typeof attrs.src === 'string') attrs.src = sanitizeHref(attrs.src) ?? ''
    result.attrs = attrs
  }

  if (result.marks) {
    result.marks = result.marks.map((mark) => {
      if (!mark.attrs?.href) return mark
      return { ...mark, attrs: { ...mark.attrs, href: sanitizeHref(mark.attrs.href) ?? '' } }
    })
  }

  if (result.content) {
    result.content = result.content.map(sanitizeJsonContent)
  }

  return result
}

const SIGNALS = [
  { pattern: /^```[\s\S]*?^```/gm, weight: 10, name: 'fencedCode' },
  { pattern: /^#{1,6}\s+\S/gm, weight: 5, name: 'atxHeading' },
  { pattern: /\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, weight: 5, name: 'inlineLink' },
  { pattern: /!\[([^\]]*)\]\([^\s)]+\)/g, weight: 5, name: 'image' },
  { pattern: /^(?:[-*+]|\d+\.)\s+\S/gm, weight: 3, name: 'listItem' },
  { pattern: /^>\s+\S/gm, weight: 3, name: 'blockquote' },
  { pattern: /\*\*[^*]+\*\*/g, weight: 2, name: 'bold' },
  { pattern: /`[^`]+`/g, weight: 2, name: 'inlineCode' }
] as const

const THRESHOLD = 6

function looksLikeMarkdown(text: string): { score: number; matches: string[] } {
  let score = 0
  const matches: string[] = []

  for (const signal of SIGNALS) {
    if (text.match(signal.pattern)?.length) {
      score += signal.weight
      matches.push(signal.name)
    }
  }

  return { score, matches }
}

function isShellHTML(html: string): boolean {
  const stripped = html.replace(/<meta[^>]*>/gi, '').trim()
  return /^<(?:span|div)[^>]*>[^<]*<\/(?:span|div)>$/i.test(stripped)
}

/**
 * Returns the plain text from clipboard if we should attempt markdown detection,
 * or null if we should let the default paste handler run.
 */
function getMarkdownCandidate(clipboardData: DataTransfer): string | null {
  const text = clipboardData.getData('text/plain')
  if (!text || text.length > MAX_CLIPBOARD_SIZE) return null
  if (clipboardData.types.includes('vscode-editor-data')) return null

  const html = clipboardData.getData('text/html')
  if (!html || isShellHTML(html)) return text
  return null
}

function isInsideCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.spec.code) return true
  }
  return false
}

export function createMarkdownPastePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('markdownPasteHandler'),
    props: {
      handlePaste(view, event) {
        if (isInsideCodeBlock(view)) return false
        if (!event.clipboardData) return false

        const text = getMarkdownCandidate(event.clipboardData)
        if (!text) return false

        const { score, matches } = looksLikeMarkdown(text)
        if (score < THRESHOLD) return false

        logger.debug('markdown-paste: heuristic match', { score, patterns: matches })
        event.preventDefault()

        try {
          const json = editor.markdown?.parse(text)
          if (!json) {
            editor.commands.insertContent({ type: 'text', text })
            return true
          }
          editor.commands.insertContent(sanitizeJsonContent(json))
        } catch (error) {
          logger.warn('markdown-paste: parse/insert failed, falling back to plain text', { error })
          editor.commands.insertContent({ type: 'text', text })
        }

        return true
      }
    }
  })
}
