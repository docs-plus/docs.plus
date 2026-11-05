import type { Modifier } from '@dnd-kit/core'

// A sideways drag sets nothing (the slot sets the level), so the card stays in the column.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
