import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { type AnyExtension, type Extensions } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { MarkdownManager } from '@tiptap/markdown'

import { isRecord } from '../../../lib/isRecord'
import { migrationExtensions } from '../../../lib/migration-extensions'
import type { TiptapDocJson } from '../types'
import { type JsonNode, mapNodes } from './mapNodes'
import { toPortableJson } from './portableJson'

// `@tiptap/markdown` nests a higher-priority mark outside a lower one. At 101,
// InlineCode would write `**` inside the backticks, so here it drops below the
// other marks. StarterKit's `code` goes off so `codespan` still imports as
// `inlineCode`; `foldCodeMark` exports stored `code` marks the same way.
const MarkdownInlineCode = InlineCode.extend({ priority: 99 })

// The migration set's `hyperlink` and `highlight` are stubs with no serializer, so
// every link and highlight would export as bare text. `conversionSchema` makes the
// same mark swap; keep both in step.
const MARKDOWN_SWAPS: Partial<Record<string, (extension: AnyExtension) => Extensions>> = {
  hyperlink: () => [],
  highlight: () => [Highlight],
  [InlineCode.name]: () => [MarkdownInlineCode],
  starterKit: (extension) => [extension.configure({ code: false })]
}

// `@tiptap/markdown` gives a token to the first extension that claims it. That
// order is not documented. Hyperlink goes first so import yields `hyperlink`;
// StarterKit's `link` stays so stored `link` marks still serialize.
const markdownExtensions: Extensions = [
  Hyperlink,
  ...migrationExtensions.flatMap(
    (extension) => MARKDOWN_SWAPS[extension.name]?.(extension) ?? [extension]
  )
]

const isCodeMark = (mark: unknown): mark is JsonNode => isRecord(mark) && mark.type === 'code'

const foldCodeMark = (node: JsonNode): JsonNode | null =>
  Array.isArray(node.marks) && node.marks.some(isCodeMark)
    ? {
        ...node,
        marks: node.marks.map((mark) =>
          isCodeMark(mark) ? { ...mark, type: InlineCode.name } : mark
        )
      }
    : null

// Constructing a manager mutates the global `marked` singleton. Its tokenizers
// accumulate rather than replace (+12 per construction with this set), so a
// per-call manager leaks unboundedly. Lazy: the module has no side effects.
let markdownManager: MarkdownManager | null = null

export const getMarkdownManager = (): MarkdownManager =>
  (markdownManager ??= new MarkdownManager({ extensions: markdownExtensions }))

export const exportMarkdown = (doc: TiptapDocJson): string =>
  getMarkdownManager().serialize(mapNodes(toPortableJson(doc, { keepEmbeds: true }), foldCodeMark))
