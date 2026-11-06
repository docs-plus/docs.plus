import type { CollisionDetection, Modifier } from '@dnd-kit/core'
import type { TocDropTarget, TocItem } from '@types'

import { tocRowMap } from '../tocClasses'

export interface DragRow {
  id: string
  rect: DOMRect
}

/** A gap between two visible rows (`index` into the row list), or a row to nest inside. */
export type DropTarget =
  | { kind: 'gap'; index: number; upperId: string | null; lowerId: string | null }
  | { kind: 'inside'; index: number; id: string }

// px past a zone edge before the target switches, so it does not flicker mid-drag.
const ZONE_HYSTERESIS = 3
// The top and bottom quarter of a row mean "between rows"; the middle half means "inside".
const EDGE_FRACTION = 0.25

// The hook owns the hit test, so dnd-kit's `over` stays null for the whole drag.
const NO_COLLISIONS: ReturnType<CollisionDetection> = []
export const noCollisions: CollisionDetection = () => NO_COLLISIONS

// The slot sets the level, so the card stays in the column.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Descendants collapse during drag, so the whole subtree moves with the item. */
export function getDescendantIds(items: TocItem[], parentId: string): string[] {
  const start = items.findIndex((item) => item.id === parentId)
  if (start === -1) return []
  const level = items[start].level
  const descendants: string[] = []
  for (let i = start + 1; i < items.length && items[i].level > level; i++) {
    descendants.push(items[i].id)
  }
  return descendants
}

/** Rows a drop can use: on screen, in order, outside the moved set. One query per call. */
export function measureDragRows(
  root: ParentNode,
  items: TocItem[],
  movingIds: Set<string>
): DragRow[] {
  const elements = tocRowMap(root)
  const rows: DragRow[] = []
  for (const item of items) {
    if (movingIds.has(item.id)) continue
    const rect = elements.get(item.id)?.getBoundingClientRect()
    // Folded rows are display:none, so they have no height and no gap.
    if (rect && rect.height > 0) rows.push({ id: item.id, rect })
  }
  return rows
}

function gapAt(rows: DragRow[], index: number): DropTarget {
  return {
    kind: 'gap',
    index,
    upperId: rows[index - 1]?.id ?? null,
    lowerId: rows[index]?.id ?? null
  }
}

/** Pick the target under the pointer: a row's edges are gaps, its middle is "inside". */
export function findDropTarget(
  pointerY: number,
  rows: DragRow[],
  current: DropTarget | null
): DropTarget | null {
  if (rows.length === 0) return null

  const zoneAt = (y: number): DropTarget => {
    const i = rows.findIndex((row) => y < row.rect.bottom)
    if (i === -1) return gapAt(rows, rows.length)
    const { top, height } = rows[i].rect
    if (y < top) return gapAt(rows, i)
    const edge = height * EDGE_FRACTION
    if (y < top + edge) return gapAt(rows, i)
    if (y > top + height - edge) return gapAt(rows, i + 1)
    return { kind: 'inside', index: i, id: rows[i].id }
  }

  const next = zoneAt(pointerY)
  if (!current || sameTarget(next, current)) return current ?? next
  // Keep the current zone until the pointer is clearly past the edge it crossed.
  const near =
    sameTarget(zoneAt(pointerY - ZONE_HYSTERESIS), current) ||
    sameTarget(zoneAt(pointerY + ZONE_HYSTERESIS), current)
  return near ? current : next
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.kind === b.kind &&
    a.index === b.index &&
    (a.kind === 'gap' || (b.kind === 'inside' && a.id === b.id)))

/** The planner's view of a target. */
export const toTocDropTarget = (target: DropTarget): TocDropTarget =>
  target.kind === 'inside'
    ? { kind: 'inside', id: target.id }
    : { kind: 'gap', upperId: target.upperId, lowerId: target.lowerId }

/** Where the gap line sits, against the lower row, else the upper row. */
export function gapLine(rows: DragRow[], target: DropTarget) {
  if (target.kind !== 'gap') return null
  const lower = rows[target.index]
  const upper = rows[target.index - 1]
  const rect = (lower ?? upper)?.rect
  if (!rect) return null
  return { y: lower ? lower.rect.top - 1.5 : rect.bottom + 1.5, left: rect.left, width: rect.width }
}
