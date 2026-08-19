import type { ImportResult, TiptapDocJson } from '../types'
import { getParseSchema } from './conversionSchema'
import { ensureTitleHeading, titleHeadingText, titleHeadingWarning } from './ensureTitleHeading'
import { getMarkdownManager } from './markdownExport'

/**
 * `marked` drops a lone image straight into a block container, but `image` is
 * inline, so `PATCH /content` answers "Invalid content for node doc" and the two
 * documented routes stop composing. The DOCX lane gets this free from
 * ProseMirror's DOMParser; Markdown reaches Tiptap JSON with no parse step.
 */
const wrapStrayInlineNodes = (doc: TiptapDocJson): TiptapDocJson => {
  const schema = getParseSchema()

  const normalize = (node: Record<string, unknown>): Record<string, unknown> => {
    const children = node.content
    if (!Array.isArray(children)) return node

    const type = typeof node.type === 'string' ? schema.nodes[node.type] : undefined
    const next = children.map((child) => {
      const walked = normalize(child as Record<string, unknown>)
      const childType = typeof walked.type === 'string' ? schema.nodes[walked.type] : undefined
      // A container that takes inline content keeps its children as they are.
      return childType?.isInline && type && !type.inlineContent
        ? { type: 'paragraph', content: [walked] }
        : walked
    })
    return { ...node, content: next }
  }

  return normalize(doc as unknown as Record<string, unknown>) as unknown as TiptapDocJson
}

/**
 * Markdown to Tiptap JSON, through the export path's manager — a second one
 * mutates the global `marked` singleton. Callers gate on `MAX_MARKDOWN_CHARS`
 * first: `marked` parses in quadratic time and blocks the event loop.
 */
export const importMarkdown = (markdown: string, fallbackTitle: string): ImportResult => {
  const parsed = getMarkdownManager().parse(markdown) as unknown as TiptapDocJson
  const { doc, branch } = ensureTitleHeading(wrapStrayInlineNodes(parsed), fallbackTitle)
  const title = titleHeadingText(doc) || fallbackTitle.trim()
  const warning = titleHeadingWarning(branch, title)

  return { content: doc, title, warnings: warning ? [warning] : [] }
}
