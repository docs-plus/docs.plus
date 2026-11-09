import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { isRecord } from '../../../lib/isRecord'
import { migrationExtensions } from '../../../lib/migration-extensions'
import { MAX_CONTENT_DEPTH, MAX_CONTENT_NODES } from '../../document-content/types'
import { MAX_IMPORT_YJS_BYTES, type TiptapDocJson } from '../types'
import type { JsonNode } from './mapNodes'

export type ImportSizeRefusal = 'TOO_MANY_NODES' | 'TOO_DEEP' | 'TOO_LARGE_TO_OPEN'

interface Frame {
  node: TiptapDocJson | JsonNode
  depth: number
}

// Iterative and stops at either cap, so a hostile tree costs at most the cap in steps.
const exceedsTreeCaps = (root: TiptapDocJson): 'TOO_MANY_NODES' | 'TOO_DEEP' | null => {
  const stack: Frame[] = [{ node: root, depth: 0 }]
  let nodes = 0
  for (let frame = stack.pop(); frame; frame = stack.pop()) {
    nodes += 1
    if (nodes > MAX_CONTENT_NODES) return 'TOO_MANY_NODES'
    if (frame.depth > MAX_CONTENT_DEPTH) return 'TOO_DEEP'
    const children = frame.node.content
    if (!Array.isArray(children)) continue
    // A loop, not a spread: a spread of a huge child list overflows the argument limit.
    for (const child of children) {
      if (isRecord(child)) stack.push({ node: child, depth: frame.depth + 1 })
    }
  }
  return null
}

/**
 * The browser applies an import with `setContent`, so `encodeContent` never sees it.
 * These are its node and depth caps plus a Yjs size cap. The encode runs only under
 * the tree caps, which bound its cost. An encode error throws to the caller.
 */
export const checkImportSize = (content: TiptapDocJson): ImportSizeRefusal | null => {
  const treeRefusal = exceedsTreeCaps(content)
  if (treeRefusal) return treeRefusal
  const doc = TiptapTransformer.toYdoc(content, 'default', migrationExtensions)
  const bytes = Y.encodeStateAsUpdate(doc).byteLength
  doc.destroy()
  return bytes > MAX_IMPORT_YJS_BYTES ? 'TOO_LARGE_TO_OPEN' : null
}
