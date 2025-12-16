import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import type { TocItem } from '@types'
import {
  flattenTocItems,
  getDescendantIds,
  getDescendantCount,
  calculateProjectedLevel,
  getPointerPosition
} from '../dnd'

interface DropTarget {
  id: string | null
  position: 'before' | 'after' | null
  rect: DOMRect | null
  level: number
}

interface DragState {
  activeId: string | null
  projectedLevel: number
  originalLevel: number
  collapsedIds: Set<string>
  descendantCount: number
  dropTarget: DropTarget
}

const initialDropTarget: DropTarget = {
  id: null,
  position: null,
  rect: null,
  level: 1
}

const initialState: DragState = {
  activeId: null,
  projectedLevel: 1,
  originalLevel: 1,
  collapsedIds: new Set(),
  descendantCount: 0,
  dropTarget: initialDropTarget
}

export function useTocDrag(items: TocItem[]) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef<number>(0)

  const flatItems = useMemo(() => flattenTocItems(items), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  )

  // Track pointer Y during drag
  useEffect(() => {
    if (!state.activeId) return

    const handlePointerMove = (e: PointerEvent) => {
      pointerYRef.current = e.clientY
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [state.activeId])

  const resetState = useCallback(() => {
    setState(initialState)
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeIdStr = String(event.active.id)
      const activeItem = flatItems.find((f) => f.id === activeIdStr)

      if (activeItem) {
        const descendants = getDescendantIds(items, activeIdStr)
        setState({
          activeId: activeIdStr,
          projectedLevel: activeItem.item.level,
          originalLevel: activeItem.item.level,
          collapsedIds: new Set(descendants),
          descendantCount: getDescendantCount(items, activeIdStr),
          dropTarget: initialDropTarget
        })
      }
    },
    [flatItems, items]
  )

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { delta, active } = event
      const activeItem = flatItems.find((f) => f.id === String(active.id))

      if (activeItem) {
        const newLevel = calculateProjectedLevel(activeItem.item.level, delta.x)
        setState((prev) => ({ ...prev, projectedLevel: newLevel }))
      }

      // Update drop position if we have a target
      setState((prev) => {
        if (!prev.dropTarget.id || pointerYRef.current <= 0) return prev

        const overElement = document.querySelector(
          `li.toc__item[data-id="${prev.dropTarget.id}"] > a`
        ) as HTMLElement

        if (!overElement) return prev

        const rect = overElement.getBoundingClientRect()
        return {
          ...prev,
          dropTarget: {
            ...prev.dropTarget,
            rect,
            position: getPointerPosition(pointerYRef.current, rect)
          }
        }
      })
    },
    [flatItems]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event

      if (!over || over.id === active.id) {
        setState((prev) => ({ ...prev, dropTarget: initialDropTarget }))
        return
      }

      setState((prev) => {
        if (prev.collapsedIds.has(String(over.id))) {
          return { ...prev, dropTarget: initialDropTarget }
        }

        const overIdStr = String(over.id)
        const overElement = document.querySelector(
          `li.toc__item[data-id="${overIdStr}"] > a`
        ) as HTMLElement

        if (!overElement) {
          return { ...prev, dropTarget: initialDropTarget }
        }

        const rect = overElement.getBoundingClientRect()
        const pointerY =
          pointerYRef.current ||
          (event.activatorEvent as PointerEvent)?.clientY ||
          rect.top + rect.height / 2

        const overItem = flatItems.find((f) => f.id === overIdStr)

        return {
          ...prev,
          dropTarget: {
            id: overIdStr,
            rect,
            position: getPointerPosition(pointerY, rect),
            level: overItem?.item.level ?? 1
          }
        }
      })
    },
    [flatItems]
  )

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    // TODO: Implement actual reordering logic here when ready
    resetState()
  }, [resetState])

  const handleDragCancel = useCallback(() => {
    resetState()
  }, [resetState])

  const activeItem = state.activeId ? items.find((i) => i.id === state.activeId) : null

  return {
    // State
    state,
    activeItem,
    flatItems,
    // DnD config
    sensors,
    // Handlers
    handlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel
    }
  }
}

