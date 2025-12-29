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
import type { ProseMirrorNode, TocItem } from '@types'
import type { DropTarget } from '../dnd'
import {
  flattenTocItems,
  getDescendantIds,
  getDescendantCount,
  calculateProjectedLevel,
  findDropTarget
} from '../dnd'
import { useStore } from '../../../stores'

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

const getItemElement = (id: string) =>
  document.querySelector(`li.toc__item[data-id="${id}"] > a`) as HTMLElement | null

export function useTocDrag(items: TocItem[]) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef(0)
  const flatItems = useMemo(() => flattenTocItems(items), [items])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Track pointer Y and set grabbing cursor during drag
  useEffect(() => {
    if (!state.activeId) return

    Object.assign(document.body.style, { cursor: 'grabbing', userSelect: 'none' })
    const onMove = (e: PointerEvent) => (pointerYRef.current = e.clientY)
    window.addEventListener('pointermove', onMove)

    return () => {
      window.removeEventListener('pointermove', onMove)
      Object.assign(document.body.style, { cursor: '', userSelect: '' })
    }
  }, [state.activeId])

  const resetState = useCallback(() => setState(initialState), [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      const active = flatItems.find((f) => f.id === id)
      if (!active) return

      const el = getItemElement(id)
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
      // Update projected level based on horizontal drag
      const active = flatItems.find((f) => f.id === String(event.active.id))
      if (active) {
        const newLevel = calculateProjectedLevel(active.item.level, event.delta.x)
        setState((prev) => ({ ...prev, projectedLevel: newLevel }))
      }

      const pointerY = pointerYRef.current
      if (pointerY <= 0) return

      // Find and normalize drop target
      setState((prev) => ({
        ...prev,
        dropTarget: findDropTarget({
          pointerY,
          flatItems,
          activeId: prev.activeId,
          collapsedIds: prev.collapsedIds,
          currentDropTarget: prev.dropTarget
        })
      }))
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
      const { dropTarget, projectedLevel, originalLevel } = state

      if (!dropTarget.id || !dropTarget.position) {
        resetState()
        return
      }

      const activeItem = flatItems.find((f) => f.id === String(event.active.id))
      const targetItem = flatItems.find((f) => f.id === dropTarget.id)
      const editor = useStore.getState().settings.editor.instance

      if (!editor) {
        resetState()
        return
      }

      // Find heading node by ID in the document
      const findHeadingById = (id: string | null | undefined) => {
        if (!id) return null
        let result: { start: number; end: number; level: number; node: ProseMirrorNode } | null =
          null
        editor.state.doc.descendants((node, pos) => {
          if (result) return false
          if (node.type.name === 'heading' && node.attrs.id === id) {
            result = {
              start: pos,
              end: pos + node.nodeSize,
              level: node.firstChild?.attrs?.level ?? 1,
              node
            }
            return false
          }
        })
        return result
      }

      console.info('[DragEnd]', {
        dragged: { id: activeItem?.id, text: activeItem?.item.textContent?.slice(0, 30) },
        target: { id: dropTarget.id, text: targetItem?.item.textContent?.slice(0, 30) },
        position: dropTarget.position,
        level: { before: originalLevel, now: projectedLevel },
        nodes: { dragged: findHeadingById(activeItem?.id), target: findHeadingById(dropTarget.id) }
      })

      // TODO: Implement reordering using dropTarget.id, dropTarget.position, projectedLevel
      resetState()
    },
    [resetState, state, flatItems]
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
