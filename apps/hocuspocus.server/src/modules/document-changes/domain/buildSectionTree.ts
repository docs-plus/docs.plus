import type { SectionChange, SectionNode } from '../types'

/**
 * A node owns the following entries of strictly greater level. Pairing already
 * produced the merged order, so this only nests. The preamble stays a root
 * sibling: at level 0 it would parent the whole outline and give every
 * breadcrumb a phantom empty ancestor.
 */
export const buildSectionTree = (changes: SectionChange[]): SectionNode[] => {
  const roots: SectionNode[] = []
  const stack: SectionNode[] = []

  for (const change of changes) {
    const node: SectionNode = { ...change, children: [] }

    if (change.level === 0) {
      roots.push(node)
      continue
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= change.level) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  return roots
}
