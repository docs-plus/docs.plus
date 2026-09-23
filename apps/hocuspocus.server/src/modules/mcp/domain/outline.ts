import type { JSONContent } from '@tiptap/core'

import { blockText } from '../../../lib/blockText'
import { headingLevel, sectionAt } from '../../document-content/domain/sections'
import { TOC_ID_ATTR } from '../../document-content/types'
import type { OutlineNode } from '../types'
import { replaceLineBreaks } from './replaceLineBreaks'

// Stored attrs are stranger-written, so an odd level must not break the tree.
const clampLevel = (node: JSONContent): number => Math.min(6, Math.max(1, headingLevel(node) ?? 1))

/**
 * The containing tree: a heading holds every later heading until one of the
 * same or a smaller level. A skipped level nests directly, with no invented node.
 */
export const buildOutline = (doc: JSONContent): OutlineNode[] => {
  const roots: OutlineNode[] = []
  const open: OutlineNode[] = []
  // A write resolves an id to its first heading, so a repeat must not offer that id.
  const seen = new Set<string>()

  const nodes = doc.content ?? []
  for (const [index, node] of nodes.entries()) {
    if (node.type !== 'heading') continue
    const tocId = node.attrs?.[TOC_ID_ATTR]
    const id = typeof tocId === 'string' && tocId.length > 0 && !seen.has(tocId) ? tocId : null
    if (id) seen.add(id)
    const entry: OutlineNode = {
      id,
      level: clampLevel(node),
      title: replaceLineBreaks(blockText([node], ' '), ' ').trim(),
      rev: id ? sectionAt(nodes, index).rev : null,
      children: []
    }

    while (open.length > 0 && (open.at(-1) as OutlineNode).level >= entry.level) open.pop()
    ;(open.at(-1)?.children ?? roots).push(entry)
    open.push(entry)
  }

  return roots
}
