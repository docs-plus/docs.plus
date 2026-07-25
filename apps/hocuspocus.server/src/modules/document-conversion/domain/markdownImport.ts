import type { ImportResult, TiptapDocJson } from '../types'
import { ensureTitleHeading, titleHeadingText, titleHeadingWarning } from './ensureTitleHeading'
import { getMarkdownManager } from './markdownExport'

/**
 * Markdown to Tiptap JSON, through the export path's manager — a second one
 * mutates the global `marked` singleton. Callers gate on `MAX_MARKDOWN_CHARS`
 * first: `marked` parses in quadratic time and blocks the event loop.
 */
export const importMarkdown = (markdown: string, fallbackTitle: string): ImportResult => {
  const parsed = getMarkdownManager().parse(markdown) as unknown as TiptapDocJson
  const { doc, branch } = ensureTitleHeading(parsed, fallbackTitle)
  const title = titleHeadingText(doc) || fallbackTitle.trim()
  const warning = titleHeadingWarning(branch, title)

  return { content: doc, title, warnings: warning ? [warning] : [] }
}
