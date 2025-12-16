import type { CollisionDetection, DroppableContainer } from '@dnd-kit/core'

/**
 * Custom collision detection that uses pointer Y position
 * to find the closest droppable container
 */
export const pointerYCollision: CollisionDetection = ({
  droppableRects,
  droppableContainers,
  pointerCoordinates
}) => {
  if (!pointerCoordinates) {
    return []
  }

  const { y: pointerY } = pointerCoordinates
  const collisions: Array<{ id: string; container: DroppableContainer; distance: number }> = []

  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id)
    if (!rect) continue

    const itemCenterY = rect.top + rect.height / 2
    const distance = Math.abs(pointerY - itemCenterY)

    collisions.push({ id: String(container.id), container, distance })
  }

  // Sort by distance (closest first)
  collisions.sort((a, b) => a.distance - b.distance)

  return collisions.map(({ id, container }) => ({
    id,
    data: { droppableContainer: container, value: id }
  }))
}

/**
 * Determine if pointer is in top or bottom half of an element
 */
export function getPointerPosition(
  pointerY: number,
  rect: { top: number; height: number }
): 'before' | 'after' {
  const middle = rect.top + rect.height / 2
  return pointerY < middle ? 'before' : 'after'
}

