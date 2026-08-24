import type { TocItem } from '@types'

import { getPointerPosition } from './pointerCollisionDetection'
import type { DropTarget, FlattenedTocItem, SnapConfig } from './types'
import { DEFAULT_SNAP_CONFIG, INDICATOR_Y_HYSTERESIS, TARGET_HYSTERESIS } from './types'

export const getItemElement = (id: string) =>
  document.querySelector(`li.toc__item[data-id="${id}"] > .toc__row`) as HTMLElement | null

export function flattenTocItems(
  items: TocItem[],
  parentId: string | null = null,
  depth: number = 0
): FlattenedTocItem[] {
  const result: FlattenedTocItem[] = []

  items.forEach((item, index) => {
    result.push({
      id: item.id,
      item,
      parentId,
      depth,
      index
    })
  })

  return result
}

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

export function getDescendantCount(items: TocItem[], parentId: string): number {
  return getDescendantIds(items, parentId).length
}

export function calculateProjectedLevel(
  originalLevel: number,
  offsetX: number,
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): number {
  const { stepSize, maxSteps, minLevel, maxLevel } = config

  // Negative offset = dragged left = outdent
  const rawSteps = Math.round(offsetX / stepSize)
  const clampedSteps = Math.max(-maxSteps, Math.min(maxSteps, rawSteps))

  const newLevel = originalLevel + clampedSteps
  return Math.max(minLevel, Math.min(maxLevel, newLevel))
}

interface FindTargetParams {
  pointerY: number
  flatItems: FlattenedTocItem[]
  activeId: string | null
  collapsedIds: Set<string>
  currentDropTarget: DropTarget
  /** Cached on dragStart — avoids O(n) layout reads every pointermove. */
  rectCache?: Map<string, DOMRect>
}

function rectForItem(id: string, rectCache?: Map<string, DOMRect>): DOMRect | null {
  const cached = rectCache?.get(id)
  if (cached) return cached
  const el = getItemElement(id)
  return el ? el.getBoundingClientRect() : null
}

/** Positions are normalized so two different rows can never describe the same gap. */
export function findDropTarget({
  pointerY,
  flatItems,
  activeId,
  collapsedIds,
  currentDropTarget,
  rectCache
}: FindTargetParams): DropTarget {
  let closest: { id: string; rect: DOMRect; dist: number } | null = null
  let currentDist = Infinity

  for (const item of flatItems) {
    if (item.id === activeId || collapsedIds.has(item.id)) continue
    const rect = rectForItem(item.id, rectCache)
    if (!rect) continue

    const dist = Math.abs(pointerY - (rect.top + rect.height / 2))

    if (item.id === currentDropTarget.id) currentDist = dist
    if (!closest || dist < closest.dist) closest = { id: item.id, rect, dist }
  }

  if (!closest) return { id: null, position: null, rect: null, level: 1, indicatorY: null }

  const shouldSwitch =
    currentDropTarget.id !== closest.id &&
    (closest.dist < currentDist - TARGET_HYSTERESIS || currentDist === Infinity)

  let targetId = shouldSwitch ? closest.id : currentDropTarget.id
  let targetIdx = flatItems.findIndex((f) => f.id === targetId)
  let targetItem = flatItems[targetIdx]
  let targetRect = rectForItem(targetId!, rectCache) ?? closest.rect

  const isSameTarget = currentDropTarget.id === targetId
  let position = getPointerPosition(
    pointerY,
    targetRect,
    isSameTarget ? currentDropTarget.position : null
  )

  // Normalize: "after parent with children" → "before firstChild"
  if (position === 'after' && targetIdx < flatItems.length - 1) {
    const next = flatItems[targetIdx + 1]
    if (
      next.item.level > (targetItem?.item.level ?? 0) &&
      !collapsedIds.has(next.id) &&
      next.id !== activeId
    ) {
      const nextRect = rectForItem(next.id, rectCache)
      if (nextRect) {
        targetId = next.id
        targetIdx = targetIdx + 1
        targetItem = next
        targetRect = nextRect
        position = 'before'
      }
    }
  }

  // Normalize: "before sibling" → "after previous leaf"
  if (position === 'before' && targetIdx > 0) {
    const prev = flatItems[targetIdx - 1]
    if (
      prev.item.level >= (targetItem?.item.level ?? 0) &&
      !collapsedIds.has(prev.id) &&
      prev.id !== activeId
    ) {
      const prevRect = rectForItem(prev.id, rectCache)
      if (prevRect) {
        targetId = prev.id
        targetItem = prev
        targetRect = prevRect
        position = 'after'
      }
    }
  }

  const rawY = position === 'before' ? targetRect.top - 1.5 : targetRect.bottom + 1.5
  const prevY = currentDropTarget.indicatorY
  const indicatorY =
    prevY !== null && Math.abs(rawY - prevY) < INDICATOR_Y_HYSTERESIS ? prevY : rawY

  return {
    id: targetId,
    rect: targetRect,
    position,
    level: targetItem?.item.level ?? 1,
    indicatorY
  }
}
