import type { Content, Editor, JSONContent } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { logger } from '@utils/logger'
import { sanitizeJsonContent } from '@utils/sanitizeContent'

const MAX_CLIPBOARD_SIZE = 500_000

interface MarkdownSignal {
  pattern: RegExp
  weight: number
  name: string
  minMatches?: number
}

const SIGNALS: readonly MarkdownSignal[] = [
  { pattern: /^```[\s\S]*?^```/m, weight: 10, name: 'fencedCode' },
  { pattern: /^#{1,6}[ \t]+\S/gm, minMatches: 2, weight: 6, name: 'multiHeading' },
  {
    pattern:
      /^[^\r\n|]*\|[^\r\n]*\r?\n[ \t]*(?:\|(?:[ \t]*:?-{1,}:?[ \t]*\|)*[ \t]*:?-{1,}:?[ \t]*(?:\|[ \t]*)?|:?-{1,}:?(?:[ \t]*\|[ \t]*:?-{1,}:?)+[ \t]*)\r?$/m,
    weight: 6,
    name: 'gfmTable'
  },
  { pattern: /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+\S/m, weight: 6, name: 'taskList' },
  { pattern: /^#{1,6}[ \t]+\S/m, weight: 5, name: 'atxHeading' },
  { pattern: /\[([^[\]\r\n]+)\]\(https?:\/\/[^\s[\])]+\)/, weight: 5, name: 'inlineLink' },
  { pattern: /!\[([^[\]\r\n]*)\]\([^\s[\])]+\)/, weight: 5, name: 'image' },
  { pattern: /^(?:[-*+]|\d+\.)\s+\S/m, weight: 3, name: 'listItem' },
  { pattern: /^>\s+\S/m, weight: 3, name: 'blockquote' },
  // A rule is also an email signature, a YAML fence and a note divider.
  // At weight 2 it cannot tip `listItem` or `blockquote` on its own, so it
  // needs a 5-point partner: a heading, a link, an image or a fence.
  { pattern: /^(?:---|\*\*\*|___)[ \t]*$/m, weight: 2, name: 'thematicBreak' },
  { pattern: /\*\*[^*]+\*\*/, weight: 2, name: 'bold' },
  { pattern: /`[^`]+`/, weight: 2, name: 'inlineCode' }
]

const THRESHOLD = 6

export function looksLikeMarkdown(text: string): { score: number; matches: string[] } {
  let score = 0
  const matches: string[] = []

  for (const signal of SIGNALS) {
    const required = signal.minMatches ?? 1
    let matched = false

    if (required > 1) {
      signal.pattern.lastIndex = 0
      let count = 0
      while (count < required && signal.pattern.exec(text)) count++
      signal.pattern.lastIndex = 0
      matched = count >= required
    } else {
      matched = signal.pattern.test(text)
    }

    if (matched) {
      score += signal.weight
      matches.push(signal.name)
    }
  }

  return { score, matches }
}

const PARAGRAPH_FIRST_CONTAINERS = new Set(['listItem', 'taskItem'])
const NON_EMPTY_BLOCK_CONTAINERS = new Set(['blockquote', 'tableCell', 'tableHeader'])

function isMeaningfulInline(node: JSONContent): boolean {
  return node.type !== 'text' || (typeof node.text === 'string' && node.text.trim().length > 0)
}

function hasNonEmptyText(node: JSONContent): boolean {
  if (node.type === 'text') {
    return typeof node.text === 'string' && node.text.trim().length > 0
  }
  return Array.isArray(node.content) && node.content.some(hasNonEmptyText)
}

function hasNonTextInline(node: JSONContent): boolean {
  return (
    Array.isArray(node.content) &&
    node.content.some((child) => child.type !== 'text' || hasNonTextInline(child))
  )
}

function isTrulyEmptyParagraph(node: JSONContent): boolean {
  return node.type === 'paragraph' && !hasNonEmptyText(node) && !hasNonTextInline(node)
}

function normalizeBlockAndInlineNodes(node: JSONContent, schema: Schema): JSONContent {
  if (!Array.isArray(node.content)) return node

  const walkedChildren = node.content.map((child) => normalizeBlockAndInlineNodes(child, schema))
  const parentType = node.type ? schema.nodes[node.type] : undefined

  if (!parentType || parentType.inlineContent) {
    return { ...node, content: walkedChildren }
  }

  const isBlockNode = (child: JSONContent): boolean => {
    const childType = child.type ? schema.nodes[child.type] : undefined
    return Boolean(childType && !childType.isInline)
  }

  const grouped: JSONContent[] = []
  let strayInlineRun: JSONContent[] = []

  const flushStrayInlineRun = (template?: JSONContent) => {
    if (strayInlineRun.length === 0) return
    if (strayInlineRun.some(isMeaningfulInline)) {
      grouped.push(
        template
          ? { ...template, content: strayInlineRun }
          : { type: 'paragraph', content: strayInlineRun }
      )
    }
    strayInlineRun = []
  }

  for (const child of walkedChildren) {
    if (
      child.type === 'paragraph' &&
      Array.isArray(child.content) &&
      child.content.some(isBlockNode)
    ) {
      flushStrayInlineRun()
      for (const grandChild of child.content) {
        if (isBlockNode(grandChild)) {
          flushStrayInlineRun(child)
          grouped.push(grandChild)
        } else {
          strayInlineRun.push(grandChild)
        }
      }
      flushStrayInlineRun(child)
      continue
    }

    const childType = child.type ? schema.nodes[child.type] : undefined
    if (childType?.isInline) {
      strayInlineRun.push(child)
    } else {
      flushStrayInlineRun()
      grouped.push(child)
    }
  }
  flushStrayInlineRun()

  if (
    PARAGRAPH_FIRST_CONTAINERS.has(node.type ?? '') &&
    (grouped.length === 0 || grouped[0].type !== 'paragraph')
  ) {
    grouped.unshift({ type: 'paragraph' })
  } else if (NON_EMPTY_BLOCK_CONTAINERS.has(node.type ?? '') && grouped.length === 0) {
    grouped.push({ type: 'paragraph' })
  }

  return { ...node, content: grouped }
}

/**
 * Ensures a parsed Markdown document conforms to `TitleDocument` (`heading block*`)
 * when replacing the full document.
 */
export function normalizeForTitleDocument(doc: JSONContent): JSONContent {
  if (doc.type !== 'doc') return doc

  const content = Array.isArray(doc.content) ? [...doc.content] : []
  while (content.length > 0 && isTrulyEmptyParagraph(content[0])) {
    content.shift()
  }

  if (content.length === 0) {
    return { ...doc, content: [{ type: 'heading', attrs: { level: 1 } }] }
  }

  const [first, ...rest] = content
  if (first.type === 'heading') {
    return {
      ...doc,
      content: [{ ...first, attrs: { ...(first.attrs ?? {}), level: 1 } }, ...rest]
    }
  }

  if (first.type === 'paragraph' && hasNonEmptyText(first)) {
    return {
      ...doc,
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          ...(first.content ? { content: first.content } : {})
        },
        ...rest
      ]
    }
  }

  return {
    ...doc,
    content: [{ type: 'heading', attrs: { level: 1 } }, ...content]
  }
}

export function normalizeMarkdownJson(
  node: JSONContent,
  schema: Schema,
  options?: { fullDoc?: boolean }
): JSONContent {
  const normalized = normalizeBlockAndInlineNodes(node, schema)
  if (options?.fullDoc && normalized.type === 'doc') {
    return normalizeForTitleDocument(normalized)
  }
  return normalized
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

function selectionSpansDocument(view: EditorView): boolean {
  const { from, to } = view.state.selection
  const size = view.state.doc.content.size
  return from <= 1 && to >= Math.max(0, size - 1)
}

function insertContentSafely(editor: Editor, view: EditorView, value: Content): boolean {
  const { from, to } = view.state.selection
  return editor.commands.insertContentAt({ from, to }, value, { errorOnInvalidContent: false })
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

        try {
          const json = editor.markdown?.parse(text)
          if (!json) return false

          const sanitized = sanitizeJsonContent(json)
          const fullDoc = selectionSpansDocument(view)
          const normalized = normalizeMarkdownJson(sanitized, editor.schema, { fullDoc })

          if (normalized.type === 'doc' && Array.isArray(normalized.content) && fullDoc) {
            editor.schema.nodeFromJSON(normalized).check()
            event.preventDefault()
            editor.commands.setContent(normalized, { errorOnInvalidContent: false })
            return true
          }

          if (normalized.type === 'doc' && Array.isArray(normalized.content)) {
            if (normalized.content.length === 0) return false
            for (const block of normalized.content) {
              editor.schema.nodeFromJSON(block).check()
            }
            event.preventDefault()
            insertContentSafely(editor, view, normalized.content)
            return true
          }

          editor.schema.nodeFromJSON(normalized).check()
          event.preventDefault()
          insertContentSafely(editor, view, normalized)
          return true
        } catch (error) {
          logger.warn('markdown-paste: parse/insert failed, falling back to default paste', {
            error
          })
          return false
        }
      }
    }
  })
}
