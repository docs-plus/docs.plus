import { computeSection } from '@components/TipTap/extensions/shared'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { TocOutlineNode } from '@types'
import { TIPTAP_NODES } from '@types'

// Documents are immutable, so one outline per doc identity serves every reader.
const outlineCache = new WeakMap<PMNode, TocOutlineNode[]>()

/**
 * The one doc-to-tree walk: the TOC rows, the move planner and section actions all read it.
 * A heading with no `toc-id` is skipped; an empty heading is kept (it shows a placeholder row).
 */
export function outlineOf(doc: PMNode): TocOutlineNode[] {
  const cached = outlineCache.get(doc)
  if (cached) return cached

  const outline: TocOutlineNode[] = []
  const stack: TocOutlineNode[] = []
  const childCount = new Map<string | null, number>()
  let pos = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const node = doc.content.child(i)
    const nodePos = pos
    pos += node.nodeSize
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) continue
    const id = node.attrs['toc-id'] as string | null
    if (!id) continue

    const level = node.attrs.level as number
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const parentId = stack.length ? stack[stack.length - 1].id : null
    const index = childCount.get(parentId) ?? 0
    childCount.set(parentId, index + 1)

    const entry: TocOutlineNode = {
      id,
      level,
      text: node.textContent,
      pos: nodePos,
      sectionTo: computeSection(doc, nodePos, level, i).to,
      parentId,
      index,
      isTitle: i === 0 && level === 1
    }
    outline.push(entry)
    stack.push(entry)
  }

  outlineCache.set(doc, outline)
  return outline
}

/** The set a move or delete acts on: the heading and every outline node inside its section. */
export function sectionNodes(outline: TocOutlineNode[], id: string): TocOutlineNode[] {
  const head = outline.find((n) => n.id === id)
  if (!head) return []
  return outline.filter((n) => n.pos >= head.pos && n.pos < head.sectionTo)
}
