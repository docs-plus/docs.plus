import type { CollisionDetection } from '@dnd-kit/core'
import type { TocItem } from '@types'

import type { DragRow, DropGap } from './types'
import { GAP_HYSTERESIS, INDICATOR_Y_HYSTERESIS } from './types'

export const getItemElement = (id: string) =>
  document.querySelector(`li.toc__item[data-id="${id}"] > .toc__row`) as HTMLElement | null

// The hook owns the hit test, so dnd-kit's `over` stays null for the whole drag.
export const noCollisions: CollisionDetection = () => []

/** Descendants collapse during drag, so the whole subtree moves with the item. */
export function getDescendantIds(items: TocItem[], parentId: string): string[] {
  const descendants: string[] = []
  let foundParent = false
  let parentLevel = 0

  for (const item of items) {
    if (item.id === parentId) {
      foundParent = true
      parentLevel = item.level
      continue
    }

    if (foundParent) {
      if (item.level > parentLevel) {
        descendants.push(item.id)
      } else {
        break
      }
    }
  }

  return descendants
}

/** Rows a drop can sit beside: on screen, in order, and outside the moved set. */
export function measureDragRows(items: TocItem[], movingIds: Set<string>): DragRow[] {
  const rows: DragRow[] = []
  for (const item of items) {
    if (movingIds.has(item.id)) continue
    const rect = getItemElement(item.id)?.getBoundingClientRect()
    // Folded rows are display:none, so they have no height and no gap.
    if (rect && rect.height > 0) rows.push({ id: item.id, rect })
  }
  return rows
}

const midline = (row: DragRow) => row.rect.top + row.rect.height / 2

export function findDropGap(
  pointerY: number,
  rows: DragRow[],
  current: DropGap | null
): DropGap | null {
  if (rows.length === 0) return null

  let index = rows.findIndex((row) => pointerY < midline(row))
  if (index === -1) index = rows.length

  // Stay in the current gap until the pointer is clearly past the midline it crossed.
  if (current && Math.abs(index - current.index) === 1) {
    const crossed = rows[Math.min(index, current.index)]
    if (Math.abs(pointerY - midline(crossed)) < GAP_HYSTERESIS) index = current.index
  }

  const upper = rows[index - 1]
  const lower = rows[index]
  const rawY = lower ? lower.rect.top - 1.5 : upper.rect.bottom + 1.5
  const indicatorY =
    current && Math.abs(rawY - current.indicatorY) < INDICATOR_Y_HYSTERESIS
      ? current.indicatorY
      : rawY

  return {
    index,
    upperId: upper?.id ?? null,
    lowerId: lower?.id ?? null,
    rect: (lower ?? upper).rect,
    indicatorY
  }
}
