import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { TocItem } from '@types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useStore } from '../../../stores'
import type { DropTarget } from '../dnd'
import {
  calculateProjectedLevel,
  findDropTarget,
  flattenTocItems,
  getDescendantCount,
  getDescendantIds,
  getItemElement
} from '../dnd'
import { moveHeadingSection } from '../utils/moveHeading'

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
  level: 1,
  indicatorY: null
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

function buildRectCache(flatItems: ReturnType<typeof flattenTocItems>): Map<string, DOMRect> {
  const cache = new Map<string, DOMRect>()
  for (const item of flatItems) {
    const el = getItemElement(item.id)
    if (el) cache.set(item.id, el.getBoundingClientRect())
  }
  return cache
}

export function useTocDrag(items: TocItem[]) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef(0)
  const rectCacheRef = useRef<Map<string, DOMRect>>(new Map())
  const scrollRafRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const flatItems = useMemo(() => flattenTocItems(items), [items])
  const flatItemsRef = useRef(flatItems)
  flatItemsRef.current = flatItems

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!state.activeId) return

    Object.assign(document.body.style, { cursor: 'grabbing', userSelect: 'none' })
    const onMove = (e: PointerEvent) => (pointerYRef.current = e.clientY)
    // Capture scroll so TOC list scroll mid-drag refreshes hit-test rects.
    const onScroll = () => {
      rectCacheRef.current = buildRectCache(flatItemsRef.current)
    }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('scroll', onScroll, true)
      Object.assign(document.body.style, { cursor: '', userSelect: '' })
    }
  }, [state.activeId])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [])

  const resetState = useCallback(() => {
    rectCacheRef.current = new Map()
    setState(initialState)
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      const active = flatItems.find((f) => f.id === id)
      if (!active) return

      const el = getItemElement(id)
      rectCacheRef.current = buildRectCache(flatItems)
      setState({
        activeId: id,
        projectedLevel: active.item.level,
        originalLevel: active.item.level,
        collapsedIds: new Set(getDescendantIds(items, id)),
        descendantCount: getDescendantCount(items, id),
        dropTarget: initialDropTarget,
        sourceRect: el ? { width: el.offsetWidth, height: el.offsetHeight } : null
      })
    },
    [flatItems, items]
  )

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const active = flatItems.find((f) => f.id === String(event.active.id))
      const pointerY = pointerYRef.current
      const newLevel = active
        ? calculateProjectedLevel(active.item.level, event.delta.x)
        : undefined

      if (pointerY <= 0 && newLevel === undefined) return

      setState((prev) => {
        const nextLevel = newLevel ?? prev.projectedLevel
        const nextDrop =
          pointerY > 0
            ? findDropTarget({
                pointerY,
                flatItems,
                activeId: prev.activeId,
                collapsedIds: prev.collapsedIds,
                currentDropTarget: prev.dropTarget,
                rectCache: rectCacheRef.current
              })
            : prev.dropTarget

        if (
          nextLevel === prev.projectedLevel &&
          nextDrop.id === prev.dropTarget.id &&
          nextDrop.position === prev.dropTarget.position &&
          nextDrop.indicatorY === prev.dropTarget.indicatorY
        ) {
          return prev
        }

        // Keep collapsedIds Set identity so memoized rows bail on pointermove.
        return { ...prev, projectedLevel: nextLevel, dropTarget: nextDrop }
      })
    },
    [flatItems]
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event
    if (!over || over.id === active.id) {
      setState((prev) => ({ ...prev, dropTarget: initialDropTarget }))
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { dropTarget, projectedLevel } = stateRef.current

      if (!dropTarget.id || !dropTarget.position) {
        resetState()
        return
      }

      const activeItem = flatItems.find((f) => f.id === String(event.active.id))
      const editor = useStore.getState().settings.editor.instance

      if (!editor || !activeItem) {
        resetState()
        return
      }

      const moved = moveHeadingSection({
        editor,
        sourceId: activeItem.id,
        targetId: dropTarget.id,
        position: dropTarget.position,
        newLevel: projectedLevel
      })

      if (moved) {
        if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = window.requestAnimationFrame(() => {
          scrollRafRef.current = null
          document
            .querySelector(`[data-toc-id="${activeItem.id}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }

      resetState()
    },
    [resetState, flatItems]
  )

  const handleDragCancel = useCallback(() => resetState(), [resetState])

  return {
    state,
    activeItem: state.activeId ? items.find((i) => i.id === state.activeId) : null,
    flatItems,
    sensors,
    handlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel
    }
  }
}
