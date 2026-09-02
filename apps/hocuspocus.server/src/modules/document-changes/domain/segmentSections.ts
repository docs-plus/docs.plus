import { blockText } from '../../../lib/blockText'
import { isRecord } from '../../../lib/isRecord'
import type { TiptapDocJson } from '../../document-content/types'
import type { Section } from '../types'
import { SECTION_TEXT_MAX_CHARS } from '../types'
import { sanitizeText } from './sanitizeText'

/** Stored attributes are stranger-written on a public document, so both are read defensively. */
const readTocId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const clean = sanitizeText(value, SECTION_TEXT_MAX_CHARS)
  return clean.length > 0 ? clean : null
}

/** An unclamped level nests the tree that deep, and 20,000 levels overflow `JSON.stringify`. */
const readLevel = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(6, Math.max(1, Math.trunc(value)))
    : 1

/**
 * Flat `heading block*` in, one section per heading out. A section owns only the
 * nodes up to the NEXT heading of any level, so editing a child never marks its
 * parent modified. The title is a section like any other.
 */
export const segmentSections = (json: TiptapDocJson): Section[] => {
  const content = Array.isArray(json.content) ? json.content : []
  const sections: Section[] = []
  let current: Section | null = null

  for (const node of content) {
    if (!isRecord(node)) continue

    if (node.type === 'heading') {
      const attrs = isRecord(node.attrs) ? node.attrs : {}
      current = {
        tocId: readTocId(attrs['toc-id']),
        level: readLevel(attrs.level),
        headingText: sanitizeText(blockText([node], ' '), SECTION_TEXT_MAX_CHARS),
        heading: node,
        nodes: []
      }
      sections.push(current)
      continue
    }

    if (current === null) {
      // Pre-heading nodes, which only legacy title-first violations carry. Level
      // 0 keeps the preamble out of the nesting rule, where its low level would
      // otherwise make it the parent of the entire outline.
      current = { tocId: null, level: 0, headingText: '', heading: null, nodes: [] }
      sections.push(current)
    }
    current.nodes.push(node)
  }

  return sections
}
