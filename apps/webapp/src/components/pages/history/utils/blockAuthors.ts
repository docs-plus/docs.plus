import type { Node as PMNode } from '@tiptap/pm/model'
import * as Y from 'yjs'

/**
 * Kept in lockstep with `VOLATILE_BLOCK_ATTRS` in
 * `apps/hocuspocus.server/src/modules/document-versions/types.ts`. The webapp cannot
 * import from that package, so this copy is deliberate — drift silently changes who
 * a block is attributed to, because the toc-id rewriter would outrank the real writer.
 */
const VOLATILE_BLOCK_ATTRS: ReadonlySet<string> = new Set(['toc-id'])

/** Nested Y types hang off `content.type`; everything else is leaf content. */
const nestedType = (item: Y.Item): Y.AbstractType<unknown> | null => {
  const content = item.content as { type?: unknown }
  return content.type instanceof Y.AbstractType ? (content.type as Y.AbstractType<unknown>) : null
}

/** Every clientID still holding live content anywhere under one root item. */
const clientIdsUnder = (rootItem: Y.Item): number[] => {
  const clients = new Set<number>()
  const stack: Y.Item[] = [rootItem]

  while (stack.length > 0) {
    const item = stack.pop() as Y.Item
    if (item.deleted) continue
    clients.add(item.id.client)

    const type = nestedType(item)
    if (type === null) continue

    for (let child = type._start; child !== null; child = child.right) stack.push(child)
    for (const [key, mapItem] of type._map) {
      if (!VOLATILE_BLOCK_ATTRS.has(key)) stack.push(mapItem)
    }
  }

  return [...clients].sort((a, b) => a - b)
}

/**
 * One clientID list per top-level block, or null when the live Y roots do not align
 * with the decoded document — marking block i with block j's writer is worse than
 * showing nothing, and a shifted mark raises no error of its own.
 */
export const collectBlockClientIds = (
  base64: string,
  expectedBlockCount: number
): number[][] | null => {
  let ydoc: Y.Doc
  try {
    ydoc = new Y.Doc()
    Y.applyUpdate(
      ydoc,
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    )
  } catch {
    return null
  }

  const roots: Y.Item[] = []
  for (let item = ydoc.getXmlFragment('default')._start; item !== null; item = item.right) {
    if (!item.deleted) roots.push(item)
  }

  if (roots.length !== expectedBlockCount) return null
  return roots.map(clientIdsUnder)
}

/**
 * Document positions of the live editor's top-level blocks, or null when its node
 * types do not match the decoded version in order. Trailing extras are tolerated:
 * TrailingNode appends an empty paragraph the version JSON does not carry.
 */
export const buildBlockRanges = (
  doc: PMNode,
  types: string[]
): { from: number; to: number }[] | null => {
  if (doc.childCount < types.length) return null

  const ranges: { from: number; to: number }[] = []
  let offset = 0
  for (let i = 0; i < types.length; i += 1) {
    const child = doc.child(i)
    if (child.type.name !== types[i]) return null
    ranges.push({ from: offset, to: offset + child.nodeSize })
    offset += child.nodeSize
  }
  return ranges
}
