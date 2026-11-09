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

// `@tiptap/markdown` gives a token to the first extension that claims it. That
// order is not documented. Hyperlink goes first so import yields `hyperlink`;
// StarterKit's `link` stays so stored `link` marks still serialize.
const markdownExtensions: Extensions = [
  Hyperlink,
  ...migrationExtensions.filter((extension) => !STUB_MARKS.has(extension.name)),
  Highlight
]

// Constructing a manager mutates the global `marked` singleton. Its tokenizers
// accumulate rather than replace (+12 per construction with this set), so a
// per-call manager leaks unboundedly. Lazy: the module has no side effects.
let markdownManager: MarkdownManager | null = null

export const getMarkdownManager = (): MarkdownManager =>
  (markdownManager ??= new MarkdownManager({ extensions: markdownExtensions }))

export const exportMarkdown = (doc: TiptapDocJson): string =>
  getMarkdownManager().serialize(toPortableJson(doc, { keepEmbeds: true }))
