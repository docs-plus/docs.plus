import { computeSection, moveSection } from '@components/TipTap/extensions/shared'
import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { type ProseMirrorNode, TIPTAP_EVENTS, type TocItem } from '@types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useStore } from '../../../stores'
import type { DropTarget } from '../dnd'
import {
  calculateProjectedLevel,
  findDropTarget,
  flattenTocItems,
  getDescendantCount,
  getDescendantIds
} from '../dnd'

// =============================================================================
// TYPES
// =============================================================================

interface HeadingInfo {
  pos: number
  end: number
  level: number
  node: ProseMirrorNode
  childIndex: number
  sectionFrom: number
  sectionTo: number
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

// =============================================================================
// HEADING HELPERS (FLAT SCHEMA)
// =============================================================================

function findHeadingById(doc: ProseMirrorNode, id: string): HeadingInfo | null {
  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const pos = offset
    offset += child.nodeSize

    if (child.type.name === 'heading' && (child.attrs['toc-id'] as string) === id) {
      const section = computeSection(doc, pos, child.attrs.level as number, i)
      return {
        pos,
        end: pos + child.nodeSize,
        level: child.attrs.level as number,
        node: child,
        childIndex: i,
        sectionFrom: section.from,
        sectionTo: section.to
      }
    }
  }

  return null
}

function calculateFlatInsertPos(
  doc: ProseMirrorNode,
  target: HeadingInfo,
  dropPosition: 'before' | 'after'
): number {
  if (dropPosition === 'before') {
    return target.sectionFrom
  }
  return target.sectionTo
}

// =============================================================================
// HOOK
// =============================================================================

export function useTocDrag(items: TocItem[]) {
  const [state, setState] = useState<DragState>(initialState)
  const pointerYRef = useRef(0)
  const flatItems = useMemo(() => flattenTocItems(items), [items])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
      const active = flatItems.find((f) => f.id === String(event.active.id))
      if (active) {
        const newLevel = calculateProjectedLevel(active.item.level, event.delta.x)
        setState((prev) => ({ ...prev, projectedLevel: newLevel }))
      }

      const pointerY = pointerYRef.current
      if (pointerY <= 0) return

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

      if (!editor || !activeItem || !targetItem) {
        resetState()
        return
      }

      const doc = editor.state.doc
      const source = findHeadingById(doc, activeItem.id)
      const target = findHeadingById(doc, dropTarget.id)

      if (!source || !target) {
        console.warn('[DragEnd] Could not find source or target node')
        resetState()
        return
      }

      const effectiveLevel = projectedLevel
      const levelDiff = effectiveLevel - originalLevel

      const isSamePosition =
        levelDiff === 0 &&
        ((dropTarget.position === 'after' && source.sectionTo === target.sectionTo) ||
          (dropTarget.position === 'before' && source.sectionFrom === target.sectionFrom))

      if (isSamePosition) {
        resetState()
        return
      }

      const insertPos = calculateFlatInsertPos(doc, target, dropTarget.position)

      console.info('[DragEnd] ===== MOVE =====')
      console.info('[DragEnd] Source:', {
        id: activeItem.id,
        level: originalLevel,
        section: [source.sectionFrom, source.sectionTo]
      })
      console.info('[DragEnd] Target:', {
        id: dropTarget.id,
        level: target.level,
        section: [target.sectionFrom, target.sectionTo]
      })
      console.info('[DragEnd] Level:', { from: originalLevel, to: effectiveLevel, diff: levelDiff })
      console.info('[DragEnd] Insert:', { position: dropTarget.position, insertPos })

      const { tr } = editor.state

      moveSection(tr, doc, source.sectionFrom, source.sectionTo, insertPos)

      if (levelDiff !== 0) {
        let headingPos: number
        if (source.sectionFrom < insertPos) {
          headingPos = tr.mapping.map(insertPos) - (source.sectionTo - source.sectionFrom)
          headingPos = Math.max(0, headingPos)
          const sectionSize = source.sectionTo - source.sectionFrom
          const mappedInsert = tr.mapping.map(insertPos)
          headingPos = mappedInsert - sectionSize
        } else {
          headingPos = insertPos
        }

        try {
          const node = tr.doc.nodeAt(headingPos)
          if (node?.type.name === 'heading') {
            tr.setNodeMarkup(headingPos, null, { ...node.attrs, level: effectiveLevel })
          }
        } catch {
          console.warn('[DragEnd] Could not update heading level')
        }
      }

      tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
      editor.view.dispatch(tr)

      requestAnimationFrame(() => {
        document
          .querySelector(`[data-toc-id="${activeItem.id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })

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
