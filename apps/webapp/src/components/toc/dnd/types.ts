import type { TocItem } from '@types'

export interface FlattenedTocItem {
  id: string
  item: TocItem
  parentId: string | null
  depth: number
  index: number
}

export interface DropTarget {
  id: string | null
  position: 'before' | 'after' | null
  rect: DOMRect | null
  level: number
  indicatorY: number | null
}

export interface SnapConfig {
  stepSize: number
  maxSteps: number
  minLevel: number
  maxLevel: number
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  stepSize: 24,
  maxSteps: 3,
  minLevel: 1,
  maxLevel: 6
}

// Hysteresis so the drop target / indicator do not flicker mid-drag.
export const TARGET_HYSTERESIS = 10 // px closer before switching targets
export const INDICATOR_Y_HYSTERESIS = 8 // px — keep prior Y if within this
