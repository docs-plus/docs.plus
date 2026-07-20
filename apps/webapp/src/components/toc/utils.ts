/** One TOC row and its subtree (built once at the root). */
export type NestedTocNode<T extends { level: number }> = {
  item: T
  nodes: NestedTocNode<T>[]
}

/**
 * Flat heading list → outline tree. O(n) single pass at each level (no repeated nesting per depth).
 */
export function buildNestedToc<T extends { level: number }>(items: T[]): NestedTocNode<T>[] {
  const result: NestedTocNode<T>[] = []

  for (let i = 0; i < items.length;) {
    const item = items[i]
    let j = i + 1
    while (j < items.length && items[j].level > item.level) {
      j++
    }
    const slice = items.slice(i + 1, j)
    result.push({ item, nodes: buildNestedToc(slice) })
    i = j
  }

  return result
}
