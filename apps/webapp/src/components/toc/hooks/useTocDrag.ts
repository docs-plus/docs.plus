import { headingFoldPluginKey } from '@components/TipTap/extensions/heading-fold'
import { type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useStore } from '@stores'
import type { TocItem } from '@types'
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  type DragRow,
  type DropTarget,
  findDropTarget,
  gapLine,
  getDescendantIds,
  measureDragRows,
  toTocDropTarget
} from '../dnd/utils'
import { TOC_CLASSES, tocRowElement } from '../tocClasses'
import { commitTocMove, planTocMove } from '../utils/tocMove'

interface DragState {
  activeId: string | null
  collapsedIds: Set<string>
  target: DropTarget | null
  /** The gap line, when the target is an allowed gap. */
  line: { y: number; left: number; width: number } | null
  /** Parent the set lands under when the target is allowed; null for root or a refusal. */
  dropParentId: string | null
  canDrop: boolean
  /** The set's own place: no line, no move, and no refusal cursor (ruling 2026-11-05). */
  isHome: boolean
  /** Row size, plus the grip's box relative to the dragged `li`, where the card is placed. */
  sourceRect: {
    width: number
    height: number
    gripX: number
    gripY: number
    gripW: number
    gripH: number
  } | null
}

const initialState: DragState = {
  activeId: null,
  collapsedIds: new Set(),
  target: null,
  line: null,
  dropParentId: null,
  canDrop: false,
  isHome: false,
  sourceRect: null
}

const editorNow = () => useStore.getState().settings.editor.instance

// DragOverlay places the card at the dragged `li`, so the held grip copies its real offset.
function measureSource(row: HTMLElement): NonNullable<DragState['sourceRect']> {
  const li = (row.parentElement ?? row).getBoundingClientRect()
  const grip = row.querySelector(`.${TOC_CLASSES.dragHandle}`)?.getBoundingClientRect()
  return {
    width: row.offsetWidth,
    height: row.offsetHeight,
    gripX: grip ? grip.left - li.left : 0,
    gripY: grip ? grip.top - li.top : 0,
    gripW: grip?.width ?? 0,
    gripH: grip?.height ?? 0
  }
}

export function useTocDrag(items: TocItem[], listRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef(0)
  const rowsRef = useRef<DragRow[]>([])
  // Row index of the gap the set left; dropping there changes nothing.
  const homeIndexRef = useRef(-1)
  const frameRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const itemsRef = useRef(items)
  itemsRef.current = items

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // After the ghost styles commit: they change row heights, so earlier rects are stale.
  useLayoutEffect(() => {
    const root = listRef.current
    if (!state.activeId || !root) return
    const sourceIndex = itemsRef.current.findIndex((i) => i.id === state.activeId)
    const moving = new Set([state.activeId, ...state.collapsedIds])
    const measure = () => {
      rowsRef.current = measureDragRows(root, itemsRef.current, moving)
      const order = new Map(itemsRef.current.map((item, i) => [item.id, i]))
      const after = rowsRef.current.findIndex((row) => (order.get(row.id) ?? 0) > sourceIndex)
      homeIndexRef.current = after === -1 ? rowsRef.current.length : after
    }
    measure()

    let scrollFrame: number | null = null
    const onScroll = () => {
      if (scrollFrame === null) {
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = null
          measure()
        })
      }
    }
    Object.assign(document.body.style, { userSelect: 'none' })
    const onMove = (e: PointerEvent) => (pointerYRef.current = e.clientY)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('scroll', onScroll, true)
      Object.assign(document.body.style, { userSelect: '' })
    }
  }, [state.activeId, state.collapsedIds, listRef])

  const refused = Boolean(state.activeId && state.target && !state.canDrop && !state.isHome)
  useEffect(() => {
    if (!state.activeId) return
    document.body.style.cursor = refused ? 'no-drop' : 'grabbing'
    return () => {
      document.body.style.cursor = ''
    }
  }, [state.activeId, refused])

  // DS-12: the landing parent's nest rail turns primary. A drop onto a row also marks that row.
  useEffect(() => {
    const root = listRef.current
    if (!state.dropParentId || !root) return
    const id = CSS.escape(state.dropParentId)
    const rail = root.querySelector(
      `li.${TOC_CLASSES.item}[data-id="${id}"] > ul.${TOC_CLASSES.children}`
    )
    const row = state.target?.kind === 'inside' ? tocRowElement(state.dropParentId, root) : null
    rail?.classList.add(TOC_CLASSES.dropParent)
    row?.classList.add(TOC_CLASSES.dropTarget)
    return () => {
      rail?.classList.remove(TOC_CLASSES.dropParent)
      row?.classList.remove(TOC_CLASSES.dropTarget)
    }
  }, [state.dropParentId, state.target?.kind, listRef])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const resetState = useCallback(() => {
    rowsRef.current = []
    homeIndexRef.current = -1
    setState(initialState)
  }, [])

  // The list can empty mid-drag (a remote edit); DndContext then unmounts and never ends the drag.
  useEffect(() => {
    if (items.length === 0 && stateRef.current.activeId) resetState()
  }, [items.length, resetState])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      const root = listRef.current
      if (!root || !items.some((i) => i.id === id)) return

      const el = tocRowElement(id, root)
      pointerYRef.current = 0
      setState({
        ...initialState,
        activeId: id,
        collapsedIds: new Set(getDescendantIds(items, id)),
        sourceRect: el ? measureSource(el) : null
      })
    },
    [items, listRef]
  )

  const handleDragMove = useCallback(() => {
    const pointerY = pointerYRef.current
    if (pointerY <= 0) return

    setState((prev) => {
      if (!prev.activeId) return prev
      const rows = rowsRef.current
      const target = findDropTarget(pointerY, rows, prev.target)
      if (target === prev.target) {
        // Same target, but a scroll may have moved the rows under the line.
        const line = prev.canDrop && target ? gapLine(rows, target) : null
        return line?.y === prev.line?.y ? prev : { ...prev, line }
      }

      const isHome = target?.kind === 'gap' && target.index === homeIndexRef.current
      // Plan only when the target changes, never per pointer move.
      const plan =
        target && !isHome ? planTocMove(editorNow(), prev.activeId, toTocDropTarget(target)) : null
      const canDrop = Boolean(plan?.ok)
      // Keep collapsedIds Set identity so memoized rows bail on pointermove.
      return {
        ...prev,
        target,
        isHome: isHome || (plan?.ok === false && plan.reason === 'noop'),
        canDrop,
        line: canDrop && target ? gapLine(rows, target) : null,
        dropParentId: plan?.ok ? plan.parentId : null
      }
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    const { activeId, target, canDrop } = stateRef.current
    resetState()
    if (!activeId || !target || !canDrop) return

    const editor = editorNow()
    const plan = planTocMove(editor, activeId, toTocDropTarget(target))
    if (!editor || !plan?.ok) return
    commitTocMove(editor, plan)

    // A drop onto a folded row opens it, so the moved section stays in view.
    if (target.kind === 'inside') {
      const folded = headingFoldPluginKey.getState(editor.state)?.foldedIds.has(target.id)
      if (folded) editor.commands.toggleFold(target.id)
    }

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const root = listRef.current
      const row = root && tocRowElement(activeId, root)
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [resetState, listRef])

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
