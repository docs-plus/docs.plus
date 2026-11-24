import { createHash } from 'node:crypto'

import type { JSONContent } from '@tiptap/core'

import { TOC_ID_ATTR } from '../types'

const REV_LENGTH = 12
/** Shared by the hop schema and the MCP input check. */
export const REV_PATTERN = new RegExp(`^[0-9a-f]{${REV_LENGTH}}$`)

/** The stored level, not clamped: callers decide what an odd level means. */
export const headingLevel = (node: JSONContent | undefined): number | null => {
  if (node?.type !== 'heading') return null
  const level = Number(node.attrs?.level)
  return Number.isInteger(level) ? level : null
}

/** Checks nodes and descendants iteratively; blockquotes, lists, and tables can nest headings. */
export const containsTitleHeading = (nodes: readonly JSONContent[]): boolean => {
  const stack: JSONContent[] = []
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    stack.push(nodes[i])
  }
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (headingLevel(node) === 1) return true
    if (Array.isArray(node.content)) {
      for (let i = node.content.length - 1; i >= 0; i -= 1) {
        stack.push(node.content[i])
      }
    }
  }
  return false
}

/** Refusal text when a new heading is too shallow, or the section is already at level 6. */
export const shallowHeadingDetail = (minHeadingLevel: number): string =>
  minHeadingLevel > 6
    ? 'level 6 is the deepest heading level, so no subheading can be added here'
    : `a new heading must be at level ${minHeadingLevel} or deeper`

export interface Section {
  headingIndex: number
  /** The body is `start` up to `end`, exclusive. */
  start: number
  end: number
  level: number
  /** The shallowest level a new heading at the body end may take: deeper than
   *  this section, and no shallower than the next heading, or it adopts that one. */
  minHeadingLevel: number
  /** Hashes the heading plus its body, so a change to either refuses a stale write. */
  rev: string
}

// Key-sorted: attribute order follows Y map insertion order, which differs
// between a live room and one decoded from bytes. Plain JSON.stringify would
// then give the same section two revs.
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : inner
  )

/** The body runs to the next heading of any level, so a subsection edit never conflicts with its parent. */
export const sectionAt = (nodes: JSONContent[], headingIndex: number): Section => {
  const start = headingIndex + 1
  let end = start
  while (end < nodes.length && nodes[end].type !== 'heading') end += 1
  const rev = createHash('sha256')
    .update(canonicalJson(nodes.slice(headingIndex, end)))
    .digest('hex')
    .slice(0, REV_LENGTH)
  const level = headingLevel(nodes[headingIndex]) ?? 1
  const minHeadingLevel = Math.max(level + 1, headingLevel(nodes[end]) ?? 0)
  return { headingIndex, start, end, level, minHeadingLevel, rev }
}

/** A repeated `toc-id` resolves to its first heading. */
export const findSection = (doc: JSONContent, tocId: string): Section | null => {
  const nodes = doc.content ?? []
  const headingIndex = nodes.findIndex(
    (node) => node.type === 'heading' && node.attrs?.[TOC_ID_ATTR] === tocId
  )
  return headingIndex === -1 ? null : sectionAt(nodes, headingIndex)
}
