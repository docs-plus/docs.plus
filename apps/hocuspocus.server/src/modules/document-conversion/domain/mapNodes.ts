import { isRecord } from '../../../lib/isRecord'

export type JsonNode = Record<string, unknown>

/** A node to put in place of this one, `'drop'` to leave it out, or null to copy it and walk its children. */
export type NodeSwap = (node: JsonNode) => JsonNode | 'drop' | null

interface Frame {
  source: unknown[]
  target: JsonNode[]
}

/**
 * A copy of the tree with `swap` applied to every node. Iterative by the same
 * rule as `encodeContent`: an explicit stack, so deep input cannot overflow it.
 */
export const mapNodes = <T extends { content?: unknown }>(doc: T, swap: NodeSwap): T => {
  const content: JsonNode[] = []
  const stack: Frame[] = [
    { source: Array.isArray(doc.content) ? doc.content : [], target: content }
  ]

  while (stack.length > 0) {
    const { source, target } = stack.pop() as Frame
    for (const child of source) {
      if (!isRecord(child)) continue
      const swapped = swap(child)
      if (swapped === 'drop') continue
      if (swapped) {
        target.push(swapped)
        continue
      }
      const copy: JsonNode = { ...child }
      if (Array.isArray(child.content)) {
        const nested: JsonNode[] = []
        copy.content = nested
        stack.push({ source: child.content, target: nested })
      }
      target.push(copy)
    }
  }

  return { ...doc, content }
}
