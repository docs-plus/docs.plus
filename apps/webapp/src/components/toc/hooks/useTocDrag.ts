import { type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useStore } from '@stores'
import type { TocItem, TocTreeMoveResult } from '@types'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { DragRow, DropGap } from '../dnd'
import { findDropGap, getDescendantIds, getItemElement, measureDragRows } from '../dnd'
import { TOC_CLASSES } from '../tocClasses'
import { applyTreeMove } from '../utils/applyTreeMove'
import { addressForGap, planTreeMove } from '../utils/planTreeMove'

interface DragState {
  activeId: string | null
  collapsedIds: Set<string>
  descendantCount: number
  gap: DropGap | null
  /** Parent the set lands under when the gap is allowed; null for root or a refusal. */
  dropParentId: string | null
  canDrop: boolean
  /** The gap is the set's own slot: no line, but not a refusal either (ruling 2026-11-04). */
  isOwnSlot: boolean
  sourceRect: { width: number; height: number } | null
}

const initialState: DragState = {
  activeId: null,
  collapsedIds: new Set(),
  descendantCount: 0,
  gap: null,
  dropParentId: null,
  canDrop: false,
  isOwnSlot: false,
  sourceRect: null
}

// Reads the live document each time: a remote edit mid-drag moves every position.
function planForGap(sourceId: string, gap: DropGap | null): TocTreeMoveResult | null {
  const editor = useStore.getState().settings.editor.instance
  if (!editor || editor.isDestroyed || !gap) return null
  const doc = editor.state.doc
  const address = addressForGap(doc, gap.upperId, gap.lowerId)
  if (!address) return null
  return planTreeMove(doc, sourceId, address, {
    locked: isDocumentEditingLocked() || !editor.isEditable
  })
}

export function useTocDrag(items: TocItem[]) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef(0)
  const rowsRef = useRef<DragRow[]>([])
  const scrollRafRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const itemsRef = useRef(items)
  itemsRef.current = items

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // After the ghost styles commit: they change row heights, so earlier rects are stale.
  useLayoutEffect(() => {
    if (!state.activeId) return
    const moving = new Set([state.activeId, ...state.collapsedIds])
    const measure = () => {
      rowsRef.current = measureDragRows(itemsRef.current, moving)
    }
    measure()

    Object.assign(document.body.style, { userSelect: 'none' })
    const onMove = (e: PointerEvent) => (pointerYRef.current = e.clientY)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('scroll', measure, true)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('scroll', measure, true)
      Object.assign(document.body.style, { userSelect: '' })
    }
  }, [state.activeId, state.collapsedIds])

  const refused = Boolean(state.activeId && state.gap && !state.canDrop && !state.isOwnSlot)
  useEffect(() => {
    if (!state.activeId) return
    document.body.style.cursor = refused ? 'no-drop' : 'grabbing'
    return () => {
      document.body.style.cursor = ''
    }
  }, [state.activeId, refused])

  // DS-12: the landing parent's nest rail turns primary; a root landing changes none.
  useEffect(() => {
    if (!state.dropParentId) return
    const rail = document.querySelector(
      `li.${TOC_CLASSES.item}[data-id="${state.dropParentId}"] > ul.${TOC_CLASSES.children}`
    )
    rail?.classList.add(TOC_CLASSES.dropParent)
    return () => rail?.classList.remove(TOC_CLASSES.dropParent)
  }, [state.dropParentId])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [])

  const resetState = useCallback(() => {
    rowsRef.current = []
    setState(initialState)
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      if (!items.some((i) => i.id === id)) return

      const el = getItemElement(id)
      const collapsedIds = new Set(getDescendantIds(items, id))
      pointerYRef.current = 0
      setState({
        ...initialState,
        activeId: id,
        collapsedIds,
        descendantCount: collapsedIds.size,
        sourceRect: el ? { width: el.offsetWidth, height: el.offsetHeight } : null
      })
    },
    [items]
  )

  const handleDragMove = useCallback(() => {
    const pointerY = pointerYRef.current
    if (pointerY <= 0) return

    setState((prev) => {
      if (!prev.activeId) return prev
      const gap = findDropGap(pointerY, rowsRef.current, prev.gap)
      const sameGap = gap?.upperId === prev.gap?.upperId && gap?.lowerId === prev.gap?.lowerId
      if (sameGap) {
        return gap?.indicatorY === prev.gap?.indicatorY ? prev : { ...prev, gap }
      }

      // Plan only when the gap changes, never per pointer move.
      const plan = planForGap(prev.activeId, gap)
      // Keep collapsedIds Set identity so memoized rows bail on pointermove.
      return {
        ...prev,
        gap,
        canDrop: Boolean(plan?.ok),
        isOwnSlot: plan?.ok === false && plan.reason === 'noop',
        dropParentId: plan?.ok ? plan.parentId : null
      }
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    const { activeId, gap, canDrop } = stateRef.current
    resetState()
    if (!activeId || !canDrop) return

    const plan = planForGap(activeId, gap)
    const editor = useStore.getState().settings.editor.instance
    if (!plan?.ok || !editor) return
    applyTreeMove(editor, plan)

    if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      document
        .querySelector(`[data-toc-id="${activeId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [resetState])

  const handleDragCancel = useCallback(() => resetState(), [resetState])

  return {
    state,
    activeItem: state.activeId ? items.find((i) => i.id === state.activeId) : null,
    sensors,
    handlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel
    }
  }
}
