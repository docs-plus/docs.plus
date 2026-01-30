import type { Modifier } from '@dnd-kit/core'

import { DEFAULT_SNAP_CONFIG } from './types'

/**
 * Restrict horizontal movement to a bounded range
 */
export function createRestrictHorizontal(maxOffset: number): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.max(-maxOffset, Math.min(maxOffset, transform.x))
  })
}

/**
 * Snap horizontal movement to discrete level steps
 */
export function createSnapToLevelGrid(stepSize: number = DEFAULT_SNAP_CONFIG.stepSize): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / stepSize) * stepSize
  })
}

/**
 * Compose multiple modifiers
 */
export function composeModifiers(...modifiers: Modifier[]): Modifier {
  return (args) => {
    return modifiers.reduce((acc, modifier) => {
      const result = modifier({ ...args, transform: acc })
      return result
    }, args.transform)
  }
}

/**
 * Main TOC drag modifier: restricts + snaps horizontal movement
 */
export const tocDragModifier: Modifier = composeModifiers(
  createRestrictHorizontal(DEFAULT_SNAP_CONFIG.stepSize * DEFAULT_SNAP_CONFIG.maxSteps),
  createSnapToLevelGrid(DEFAULT_SNAP_CONFIG.stepSize)
)
