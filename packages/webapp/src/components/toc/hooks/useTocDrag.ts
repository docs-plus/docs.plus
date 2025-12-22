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
  sourceRect: { width: number; height: number } | null
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
  dropTarget: initialDropTarget,
  sourceRect: null
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

  // Track pointer Y during drag and set cursor
  useEffect(() => {
    if (!state.activeId) return

    // Set grabbing cursor on body
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (e: PointerEvent) => {
      pointerYRef.current = e.clientY
    }

    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
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

        // Capture source element dimensions
        const sourceElement = document.querySelector(
          `li.toc__item[data-id="${activeIdStr}"] > a`
        ) as HTMLElement

        const sourceRect = sourceElement
          ? { width: sourceElement.offsetWidth, height: sourceElement.offsetHeight }
          : null

        setState({
          activeId: activeIdStr,
          projectedLevel: activeItem.item.level,
          originalLevel: activeItem.item.level,
          collapsedIds: new Set(descendants),
          descendantCount: getDescendantCount(items, activeIdStr),
          dropTarget: initialDropTarget,
          sourceRect
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

        const pointerY = pointerYRef.current || (event.activatorEvent as PointerEvent)?.clientY || 0

        if (pointerY <= 0) {
          return { ...prev, dropTarget: initialDropTarget }
        }

        // Find closest visible item to pointer Y
        let closestId = String(over.id)
        let closestRect: DOMRect | null = null
        let closestDist = Infinity

        for (const item of flatItems) {
          if (item.id === prev.activeId || prev.collapsedIds.has(item.id)) continue

          const element = document.querySelector(
            `li.toc__item[data-id="${item.id}"] > a`
          ) as HTMLElement
          if (!element) continue

          const rect = element.getBoundingClientRect()
          const centerY = rect.top + rect.height / 2
          const dist = Math.abs(pointerY - centerY)

          if (dist < closestDist) {
            closestDist = dist
            closestId = item.id
            closestRect = rect
          }
        }

        if (!closestRect) {
          return { ...prev, dropTarget: initialDropTarget }
        }

        const closestItem = flatItems.find((f) => f.id === closestId)

        return {
          ...prev,
          dropTarget: {
            id: closestId,
            rect: closestRect,
            position: getPointerPosition(pointerY, closestRect),
            level: closestItem?.item.level ?? 1
          }
        }
      })
    },
    [flatItems]
  )

  const handleDragEnd = useCallback(
    (_event: DragEndEvent) => {
      // TODO: Implement actual reordering logic here when ready
      resetState()
    },
    [resetState]
  )

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
