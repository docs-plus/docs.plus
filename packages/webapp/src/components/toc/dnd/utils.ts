import type { TocItem } from '@types'
import type { FlattenedTocItem, SnapConfig } from './types'
import { DEFAULT_SNAP_CONFIG } from './types'

/**
 * Flatten nested TOC items into a flat array with depth info
 */
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

/**
 * Get all descendant IDs of a given item (for collapsing during drag)
 */
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

/**
 * Get count of descendants for a given item
 */
export function getDescendantCount(items: TocItem[], parentId: string): number {
  return getDescendantIds(items, parentId).length
}

/**
 * Calculate projected level based on horizontal offset
 */
export function calculateProjectedLevel(
  originalLevel: number,
  offsetX: number,
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): number {
  const { stepSize, maxSteps, minLevel, maxLevel } = config

  // Calculate steps from offset (negative = left = decrease level)
  const rawSteps = Math.round(offsetX / stepSize)
  const clampedSteps = Math.max(-maxSteps, Math.min(maxSteps, rawSteps))

  // Calculate new level
  const newLevel = originalLevel + clampedSteps
  return Math.max(minLevel, Math.min(maxLevel, newLevel))
}
