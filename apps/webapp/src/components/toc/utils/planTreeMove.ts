import { computeSection } from '@components/TipTap/extensions/shared'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { TocOutlineNode, TocTreeAddress, TocTreeMoveResult } from '@types'
import { TIPTAP_NODES } from '@types'

const MIN_LEVEL = 1
const MAX_LEVEL = 6

// Documents are immutable, so one outline per doc identity serves every hover plan.
const outlineCache = new WeakMap<PMNode, TocOutlineNode[]>()

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

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

    const level = node.attrs.level as number
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const parentId = stack.length ? stack[stack.length - 1].id : null
    const index = childCount.get(parentId) ?? 0
    childCount.set(parentId, index + 1)

    const entry: TocOutlineNode = {
      id: node.attrs['toc-id'] as string,
      level,
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

/** A gap above row W means "before W"; below the last row U means "after U". */
export function addressForGap(
  doc: PMNode,
  upperId: string | null,
  lowerId: string | null
): TocTreeAddress | null {
  const outline = outlineOf(doc)
  const lower = lowerId ? outline.find((n) => n.id === lowerId) : undefined
  if (lower) return { parentId: lower.parentId, index: lower.index }
  const upper = upperId ? outline.find((n) => n.id === upperId) : undefined
  if (upper) return { parentId: upper.parentId, index: upper.index + 1 }
  return null
}

/**
 * Pure. Lands the source set at `to` without re-parenting any heading outside it
 * (R2 overturn): `L = clamp(source, lo, hi)` and every set heading shifts by `d`.
 */
export function planTreeMove(
  doc: PMNode,
  sourceId: string,
  to: TocTreeAddress,
  { locked }: { locked: boolean }
): TocTreeMoveResult {
  if (locked) return { ok: false, reason: 'locked' }

  const outline = outlineOf(doc)
  const source = outline.find((n) => n.id === sourceId)
  if (!source) return { ok: false, reason: 'not-found' }
  if (source.isTitle) return { ok: false, reason: 'title-fixed' }

  const parent = to.parentId === null ? null : outline.find((n) => n.id === to.parentId)
  if (parent === undefined) return { ok: false, reason: 'not-found' }
  if (parent && parent.pos >= source.pos && parent.pos < source.sectionTo) {
    return { ok: false, reason: 'inside-own-set' }
  }

  const siblings = outline.filter((n) => n.parentId === to.parentId)
  const index = clamp(to.index, 0, siblings.length)
  if (!parent && index === 0 && siblings[0]?.isTitle) return { ok: false, reason: 'above-title' }

  const parentLevel = parent?.level ?? 0
  if (parentLevel >= MAX_LEVEL) return { ok: false, reason: 'no-room' }

  const prev = siblings.slice(0, index).filter((n) => n.id !== sourceId)
  const S = prev[prev.length - 1]
  const N = siblings.slice(index).find((n) => n.id !== sourceId)
  const lo = Math.max(parentLevel + 1, N?.level ?? 0)
  const hi = S ? S.level : lo
  if (lo > hi) return { ok: false, reason: 'no-room' }

  const L = clamp(source.level, lo, hi)
  const isOwnSlot =
    source.parentId === to.parentId && (index === source.index || index === source.index + 1)
  if (isOwnSlot && L === source.level) return { ok: false, reason: 'noop' }

  const insertPos = N ? N.pos : parent ? parent.sectionTo : doc.content.size
  const size = source.sectionTo - source.pos
  return {
    ok: true,
    sourceId,
    from: source.pos,
    to: source.sectionTo,
    insertPos,
    landedFrom: insertPos >= source.sectionTo ? insertPos - size : insertPos,
    L,
    d: L - source.level,
    parentId: to.parentId
  }
}

export const clampHeadingLevel = (level: number) => clamp(level, MIN_LEVEL, MAX_LEVEL)
