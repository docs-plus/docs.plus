import type { Node as PMNode } from '@tiptap/pm/model'
import * as Y from 'yjs'

import { VOLATILE_BLOCK_ATTRS } from '../types'

// The webapp keeps a lockstep copy of this walk in
// `apps/webapp/src/components/pages/history/utils/blockAuthors.ts` — it runs the
// same attribution client-side from bytes it already holds. Change both together.

/** Nested Y types hang off `content.type`; everything else is leaf content. */
const nestedType = (item: Y.Item): Y.AbstractType<unknown> | null => {
  const content = item.content as { type?: unknown }
  return content.type instanceof Y.AbstractType ? (content.type as Y.AbstractType<unknown>) : null
}

/**
 * Every clientID still holding live content anywhere under one root item.
 * Attribute items count: a task checkbox toggle lives in `_map`, not in
 * text. Volatile keys do not, or the toc-id rewriter outranks the real author.
 */
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
 * Returns one clientID list per top-level block of `afterDoc`, or null when the
 * live Y root items do not align with it. Misattributing block i to block j's
 * author is worse than no attribution.
 */
export const collectBlockClientIds = (
  afterBytes: Uint8Array,
  afterDoc: PMNode
): number[][] | null => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, afterBytes)

  const roots: Y.Item[] = []
  for (let item = ydoc.getXmlFragment('default')._start; item !== null; item = item.right) {
    if (!item.deleted) roots.push(item)
  }

  if (roots.length !== afterDoc.childCount) return null
  return roots.map(clientIdsUnder)
}
