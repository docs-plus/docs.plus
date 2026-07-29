import type { Modifier } from '@dnd-kit/core'

import { DEFAULT_SNAP_CONFIG } from './types'

export function createRestrictHorizontal(maxOffset: number): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.max(-maxOffset, Math.min(maxOffset, transform.x))
  })
}

export function createSnapToLevelGrid(stepSize: number = DEFAULT_SNAP_CONFIG.stepSize): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / stepSize) * stepSize
  })
}

export function composeModifiers(...modifiers: Modifier[]): Modifier {
  return (args) => {
    return modifiers.reduce((acc, modifier) => {
      const result = modifier({ ...args, transform: acc })
      return result
    }, args.transform)
  }
}

export const tocDragModifier: Modifier = composeModifiers(
  createRestrictHorizontal(DEFAULT_SNAP_CONFIG.stepSize * DEFAULT_SNAP_CONFIG.maxSteps),
  createSnapToLevelGrid(DEFAULT_SNAP_CONFIG.stepSize)
)
