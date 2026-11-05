import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { StepMap } from '@tiptap/pm/transform'
import type { TocDropTarget, TocTreeAddress, TocTreeMovePlan, TocTreeMoveResult } from '@types'
import { TIPTAP_EVENTS, TIPTAP_NODES } from '@types'

import { outlineOf } from './outline'

const MIN_LEVEL = 1
const MAX_LEVEL = 6

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * A gap above row W means "before W"; below the last row U means "after U".
 * Inside a row means "after its last child", so a leaf takes its first child.
 */
export function addressForTarget(doc: PMNode, target: TocDropTarget): TocTreeAddress | null {
  const outline = outlineOf(doc)
  if (target.kind === 'inside') {
    if (!outline.some((n) => n.id === target.id)) return null
    return { parentId: target.id, index: outline.filter((n) => n.parentId === target.id).length }
  }
  const lower = target.lowerId ? outline.find((n) => n.id === target.lowerId) : undefined
  if (lower) return { parentId: lower.parentId, index: lower.index }
  const upper = target.upperId ? outline.find((n) => n.id === target.upperId) : undefined
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

  return {
    ok: true,
    from: source.pos,
    to: source.sectionTo,
    insertPos: N ? N.pos : parent ? parent.sectionTo : doc.content.size,
    L,
    d: L - source.level,
    parentId: to.parentId
  }
}

export const clampHeadingLevel = (level: number) => clamp(level, MIN_LEVEL, MAX_LEVEL)

function shiftLevels(content: Fragment, d: number): Fragment {
  if (d === 0) return content
  const nodes: PMNode[] = []
  content.forEach((node) => {
    nodes.push(
      node.type.name === TIPTAP_NODES.HEADING_TYPE
        ? node.type.create(
            { ...node.attrs, level: clampHeadingLevel((node.attrs.level as number) + d) },
            node.content,
            node.marks
          )
        : node
    )
  })
  return Fragment.from(nodes)
}

/**
 * Pure: the plan must come from `state.doc`. One transaction, so one undo step.
 * Delete first: inserting first briefly holds two copies of every `toc-id`.
 * A caret inside the set rides with it (#520).
 */
export function treeMoveTransaction(state: EditorState, plan: TocTreeMovePlan): Transaction {
  const { doc, selection } = state
  const { from, to } = plan
  const tr = state.tr.delete(from, to)
  const landedFrom = tr.mapping.map(plan.insertPos)
  tr.insert(landedFrom, shiftLevels(doc.slice(from, to).content, plan.d))

  if (selection.from >= from && selection.to <= to) {
    // A level change keeps every node size, so offsets inside the set are exact.
    tr.setSelection(selection.map(tr.doc, StepMap.offset(landedFrom - from)))
  }
  return tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
}
