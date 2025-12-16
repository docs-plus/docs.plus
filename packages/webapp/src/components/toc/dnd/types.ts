import type { TocItem } from '@types'

/**
 * Flattened representation of a TOC item for drag-and-drop
 */
export interface FlattenedTocItem {
  id: string
  item: TocItem
  parentId: string | null
  depth: number
  index: number
}

/**
 * Configuration for level snapping
 */
export interface SnapConfig {
  stepSize: number // pixels per level step
  maxSteps: number // maximum steps in either direction (±3)
  minLevel: number // H1
  maxLevel: number // H6 (or H10)
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  stepSize: 24,
  maxSteps: 3,
  minLevel: 1,
  maxLevel: 6
}
