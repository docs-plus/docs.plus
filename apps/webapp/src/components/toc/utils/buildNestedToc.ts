export type NestedTocNode<T extends { id: string; level: number }> = {
  item: T
  nodes: NestedTocNode<T>[]
}

const NO_CHILDREN: never[] = []

/**
 * O(n) single pass. Pass the previous result to keep every unchanged node object,
 * so memoized rows skip a render when another heading changes.
 */
export function buildNestedToc<T extends { id: string; level: number }>(
  items: T[],
  prev: NestedTocNode<T>[] = NO_CHILDREN
): NestedTocNode<T>[] {
  const prevById = new Map<string, NestedTocNode<T>>()
  const index = (nodes: NestedTocNode<T>[]) =>
    nodes.forEach((node) => {
      prevById.set(node.item.id, node)
      index(node.nodes)
    })
  index(prev)

  const build = (from: number, to: number): NestedTocNode<T>[] => {
    const result: NestedTocNode<T>[] = []
    for (let i = from; i < to;) {
      const item = items[i]
      let j = i + 1
      while (j < to && items[j].level > item.level) j++
      const nodes = j > i + 1 ? build(i + 1, j) : NO_CHILDREN
      const old = prevById.get(item.id)
      const same =
        old !== undefined &&
        old.item === item &&
        old.nodes.length === nodes.length &&
        old.nodes.every((node, k) => node === nodes[k])
      result.push(same ? old : { item, nodes })
      i = j
    }
    return result
  }
  return build(0, items.length)
}
