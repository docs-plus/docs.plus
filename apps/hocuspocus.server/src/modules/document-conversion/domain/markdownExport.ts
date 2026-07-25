import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { type Extensions } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { MarkdownManager } from '@tiptap/markdown'

import { migrationExtensions } from '../../../lib/migration-extensions'
import type { TiptapDocJson } from '../types'
import { toPortableJson } from './portableJson'

// Same swap `conversionSchema` makes, duplicated because it exports schemas
// rather than the extension set. The migration stubs carry no markdown hooks,
// so every link and highlight would serialize as bare text. Keep both in step.
const STUB_MARKS = new Set(['hyperlink', 'highlight'])

const markdownExtensions: Extensions = [
  ...migrationExtensions.filter((extension) => !STUB_MARKS.has(extension.name)),
  Hyperlink,
  Highlight
]

// Constructing a manager mutates the global `marked` singleton, and its tokenizers
// accumulate rather than replace (+12 per construction with this set), so a
// per-call manager leaks unboundedly. Lazy: the module has no side effects.
let markdownManager: MarkdownManager | null = null

/** Exported so `markdownImport` parses through this instance instead of a second one. */
export const getMarkdownManager = (): MarkdownManager =>
  (markdownManager ??= new MarkdownManager({ extensions: markdownExtensions }))

/** Shares `toPortableJson` with the HTML path so both exports see one document. */
export const exportMarkdown = (doc: TiptapDocJson): string =>
  getMarkdownManager().serialize(toPortableJson(doc))
