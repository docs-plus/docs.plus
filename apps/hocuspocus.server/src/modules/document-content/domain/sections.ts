import { createHash } from 'node:crypto'

import type { JSONContent } from '@tiptap/core'

const TOC_ID_ATTR = 'toc-id'

const headingLevel = (node: JSONContent | undefined): number | null => {
  if (node?.type !== 'heading') return null
  const level = Number(node.attrs?.level)
  return Number.isInteger(level) ? level : null
}

/** Top-level only: the flat schema keeps every heading a root child. */
export const containsTitleHeading = (nodes: JSONContent[]): boolean =>
  nodes.some((node) => headingLevel(node) === 1)

/** A replacing heading at or above the target level would re-parent the subsections after it. */
export const containsHeadingAtOrAbove = (nodes: JSONContent[], level: number): boolean =>
  nodes.some((node) => {
    const nodeLevel = headingLevel(node)
    return nodeLevel !== null && nodeLevel <= level
  })

/** The body runs to the next heading of any level, so a subsection edit never conflicts with its parent. */
export function findSectionBody(
  doc: JSONContent,
  tocId: string
): { headingIndex: number; start: number; end: number; level: number } | null {
  const nodes = doc.content ?? []
  const headingIndex = nodes.findIndex(
    (node) => node.type === 'heading' && node.attrs?.[TOC_ID_ATTR] === tocId
  )
  if (headingIndex === -1) return null

  const level = headingLevel(nodes[headingIndex]) ?? 1
  const start = headingIndex + 1
  let end = start
  while (end < nodes.length && nodes[end].type !== 'heading') end += 1
  return { headingIndex, start, end, level }
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

export function sectionRev(doc: JSONContent, tocId: string): string | null {
  const section = findSectionBody(doc, tocId)
  if (!section) return null
  const nodes = doc.content ?? []
  return createHash('sha256')
    .update(canonicalJson(nodes.slice(section.headingIndex, section.end)))
    .digest('hex')
    .slice(0, 12)
}
