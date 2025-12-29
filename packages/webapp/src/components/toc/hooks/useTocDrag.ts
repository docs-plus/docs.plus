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
import { TIPTAP_EVENTS, type ProseMirrorNode, type TocItem, type Schema } from '@types'
import type { DropTarget } from '../dnd'
import {
  flattenTocItems,
  getDescendantIds,
  getDescendantCount,
  calculateProjectedLevel,
  findDropTarget
} from '../dnd'
import { useStore } from '../../../stores'

// =============================================================================
// TYPES
// =============================================================================

interface HeadingNode {
  pos: number
  end: number
  level: number
  node: ProseMirrorNode
  /** Position at end of contentWrapper content (node.end - 2) */
  contentEnd: number
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
// HEADING HELPERS
// =============================================================================

/**
 * Process a heading for level change:
 * 1. Update the root heading's level
 * 2. Extract children that are shallower than or equal to new level (they become siblings)
 * 3. Keep only children deeper than new level
 *
 * Returns { node: modified heading, extracted: array of nodes to insert as siblings }
 */
function processHeadingForLevelChange(
  node: ProseMirrorNode,
  newLevel: number,
  schema: Schema
): { node: ProseMirrorNode; extracted: ProseMirrorNode[] } {
  const json = node.toJSON()
  const extracted: any[] = []

  if (json.type === 'heading' && typeof json.attrs?.level === 'number') {
    // Update root heading level
    json.attrs = { ...json.attrs, level: newLevel }

    // Update contentHeading level (first child)
    if (json.content?.[0]?.type === 'contentHeading') {
      json.content[0] = {
        ...json.content[0],
        attrs: { ...json.content[0].attrs, level: newLevel }
      }
    }

    // Process contentWrapper (second child) - extract shallower children
    if (json.content?.[1]?.type === 'contentWrapper') {
      const contentWrapper = json.content[1]
      const keptChildren: any[] = []

      for (const child of contentWrapper.content || []) {
        if (child.type === 'heading' && typeof child.attrs?.level === 'number') {
          // Heading child: check if it should be extracted
          if (child.attrs.level <= newLevel) {
            // Shallower or equal: extract as sibling
            extracted.push(child)
          } else {
            // Deeper: keep as child
            keptChildren.push(child)
          }
        } else {
          // Non-heading content (paragraphs, etc): keep
          keptChildren.push(child)
        }
      }

      // Update contentWrapper with only kept children
      json.content[1] = { ...contentWrapper, content: keptChildren }
    }
  }

  return {
    node: schema.nodeFromJSON(json),
    extracted: extracted.map((e) => schema.nodeFromJSON(e))
  }
}

/**
 * Find a heading by ID and return its position info.
 */
function findHeadingById(doc: ProseMirrorNode, id: string): HeadingNode | null {
  let result: HeadingNode | null = null

  doc.descendants((node, pos) => {
    if (result) return false
    if (node.type.name === 'heading' && node.attrs.id === id) {
      result = {
        pos,
        end: pos + node.nodeSize,
        level: node.firstChild?.attrs?.level ?? 1,
        node,
        contentEnd: pos + node.nodeSize - 2
      }
      return false
    }
  })

  return result
}

/**
 * Get all headings in the document.
 */
function getAllHeadings(doc: ProseMirrorNode): HeadingNode[] {
  const headings: HeadingNode[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos,
        end: pos + node.nodeSize,
        level: node.firstChild?.attrs?.level ?? 1,
        node,
        contentEnd: pos + node.nodeSize - 2
      })
    }
  })

  return headings
}

/**
 * Find the containing H1 section for a position.
 */
function findContainingH1(headings: HeadingNode[], pos: number): HeadingNode | null {
  return headings.find((h) => h.level === 1 && h.pos <= pos && h.end > pos) ?? null
}

// =============================================================================
// INSERT POSITION CALCULATION (STACK-ATTACH SEMANTICS)
// =============================================================================

interface InsertResult {
  pos: number
  reason: string
}

/**
 * STACK-ATTACH parent finder:
 * Find the heading that would be the parent for a heading of `effectiveLevel`
 * inserted near `referencePos`.
 *
 * Per STACK-ATTACH: parent is the nearest heading with level < effectiveLevel
 * that CONTAINS the reference position.
 */
function findStackAttachParent(
  headings: HeadingNode[],
  referencePos: number,
  effectiveLevel: number
): HeadingNode | null {
  // Walk through headings, find the one that:
  // 1. Has level < effectiveLevel
  // 2. Contains referencePos (pos <= referencePos < end)
  // We want the DEEPEST such heading (most specific parent)
  let parent: HeadingNode | null = null

  for (const h of headings) {
    if (h.level < effectiveLevel && h.pos <= referencePos && h.end > referencePos) {
      // This heading contains referencePos and could be parent
      // Keep the deepest one (later in iteration = more nested)
      parent = h
    }
  }

  return parent
}

/**
 * Find the direct child of `parent` that contains or equals `target`.
 * This helps us find the right sibling boundary when target is deeply nested.
 */
function findDirectChildContaining(
  headings: HeadingNode[],
  parent: HeadingNode,
  target: HeadingNode
): HeadingNode | null {
  // Find headings that are direct children of parent (inside parent's contentWrapper)
  // and contain target.pos
  const contentStart = parent.pos + (parent.node.firstChild?.nodeSize ?? 0) + 1
  const contentEnd = parent.contentEnd

  for (const h of headings) {
    // Is h a direct child of parent?
    if (h.pos > contentStart && h.pos < contentEnd) {
      // Check if h is at the right nesting level (direct child, not grandchild)
      // A direct child's parent should be `parent`
      const hParent = findStackAttachParent(headings, h.pos, h.level)
      if (hParent && hParent.pos === parent.pos) {
        // h is a direct child of parent
        // Does h contain target?
        if (h.pos <= target.pos && h.end >= target.end) {
          return h
        }
      }
    }
  }

  return null
}

/**
 * Calculate insert position using STACK-ATTACH semantics.
 *
 * STACK-ATTACH rule: H(ℓ) attaches to the first ancestor with level < ℓ.
 *
 * Algorithm:
 * 1. Find the STACK-ATTACH parent for effectiveLevel
 * 2. Insert inside that parent's contentWrapper
 * 3. Use before/after + target to determine position among siblings
 */
function calculateInsertPos(
  doc: ProseMirrorNode,
  target: HeadingNode,
  effectiveLevel: number,
  _levelDiff: number, // kept for API compatibility
  dropPosition: 'before' | 'after'
): InsertResult {
  const allHeadings = getAllHeadings(doc)

  // =========================================================================
  // SPECIAL CASE: H1 (must be at document root)
  // =========================================================================
  if (effectiveLevel === 1) {
    const containingH1 = findContainingH1(allHeadings, target.pos)
    if (containingH1) {
      return {
        pos: dropPosition === 'before' ? containingH1.pos : containingH1.end,
        reason: `H1: document root (${dropPosition} section)`
      }
    }
    return { pos: target.pos, reason: 'H1: fallback' }
  }

  // =========================================================================
  // SPECIAL CASE: NESTING INSIDE TARGET (after only)
  // =========================================================================
  // When dropping "after" a target with effectiveLevel > target.level,
  // the target itself IS the STACK-ATTACH parent. We handle this explicitly
  // because findStackAttachParent uses target.end as reference, which is
  // outside the target and won't find target as a valid parent.
  if (dropPosition === 'after' && effectiveLevel > target.level) {
    return {
      pos: target.contentEnd,
      reason: `after: nesting inside H${target.level} (${effectiveLevel} > ${target.level})`
    }
  }

  // =========================================================================
  // SPECIAL CASE: SIBLING BEFORE TARGET
  // =========================================================================
  // When dropping "before" a target, we always want to be a SIBLING of target,
  // not a child. Even if effectiveLevel > target.level, we insert at target.pos
  // so the new heading appears before target in document order.
  // STACK-ATTACH will determine the parent based on the heading levels.
  if (dropPosition === 'before' && effectiveLevel > target.level) {
    return {
      pos: target.pos,
      reason: `before: sibling of H${target.level} (inserting at target.pos)`
    }
  }

  // =========================================================================
  // FIND STACK-ATTACH PARENT
  // =========================================================================
  const referencePos = dropPosition === 'before' ? target.pos : target.end
  const parent = findStackAttachParent(allHeadings, referencePos, effectiveLevel)

  if (!parent) {
    // No valid parent found - this shouldn't happen for well-formed docs
    // Fallback: insert relative to target
    return {
      pos: dropPosition === 'before' ? target.pos : target.end,
      reason: 'No parent found (fallback)'
    }
  }

  // Parent's content boundaries
  const parentContentStart = parent.pos + (parent.node.firstChild?.nodeSize ?? 0) + 1
  const parentContentEnd = parent.contentEnd

  // =========================================================================
  // CASE: TARGET IS THE PARENT
  // =========================================================================
  if (target.pos === parent.pos) {
    if (dropPosition === 'before') {
      // "Before" the parent = first child of parent
      return { pos: parentContentStart, reason: `before parent: first child of H${parent.level}` }
    } else {
      // "After" the parent = last child of parent
      return { pos: parentContentEnd, reason: `after parent: last child of H${parent.level}` }
    }
  }

  // =========================================================================
  // CASE: TARGET IS INSIDE PARENT
  // =========================================================================
  // Target might be a direct child or a deeper descendant of parent.
  // We need to find the right insertion point.

  if (dropPosition === 'before') {
    // We want to insert before target, inside parent's contentWrapper

    // Check if target is directly inside parent
    if (target.pos >= parentContentStart && target.end <= parent.end) {
      // Find the direct child of parent that contains target
      const directChild = findDirectChildContaining(allHeadings, parent, target)

      if (directChild && directChild.pos !== target.pos) {
        // Target is nested inside a direct child - insert before that direct child
        return {
          pos: directChild.pos,
          reason: `before: at sibling boundary (before H${directChild.level})`
        }
      }

      // Target is the direct child or no intermediary found
      return { pos: target.pos, reason: `before: at target.pos inside H${parent.level}` }
    }

    // Target is outside parent's content - insert at start of parent's content
    return { pos: parentContentStart, reason: `before: at parent contentStart (target outside)` }
  }

  // dropPosition === 'after'
  // We want to insert after target (and its children), inside parent's contentWrapper

  if (target.pos >= parentContentStart && target.end <= parent.end) {
    // Find the direct child of parent that contains target
    const directChild = findDirectChildContaining(allHeadings, parent, target)

    if (directChild && directChild.pos !== target.pos) {
      // Target is nested inside a direct child - insert after that direct child
      return {
        pos: directChild.end,
        reason: `after: at sibling boundary (after H${directChild.level})`
      }
    }

    // Target is the direct child or no intermediary found
    return { pos: target.end, reason: `after: at target.end inside H${parent.level}` }
  }

  // Target extends beyond parent - insert at end of parent's content
  return { pos: parentContentEnd, reason: `after: at parent contentEnd (target outside)` }
}

// =============================================================================
// HOOK
// =============================================================================

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
      const schema = editor.state.schema

      const source = findHeadingById(doc, activeItem.id)
      const target = findHeadingById(doc, dropTarget.id)

      if (!source || !target) {
        console.warn('[DragEnd] Could not find source or target node')
        resetState()
        return
      }

      // Validate level changes
      let effectiveLevel = projectedLevel

      // H2+ → H1: promoting to section level is allowed
      // The heading will be extracted from its parent and become a root section

      const levelDiff = effectiveLevel - originalLevel

      // Check if this is a no-op
      const isSamePosition =
        levelDiff === 0 &&
        ((dropTarget.position === 'after' && source.pos === target.end) ||
          (dropTarget.position === 'before' && source.end === target.pos))

      if (isSamePosition) {
        resetState()
        return
      }

      // Calculate insert position
      let { pos: insertPos, reason } = calculateInsertPos(
        doc,
        target,
        effectiveLevel,
        levelDiff,
        dropTarget.position
      )

      // Note: We always calculate insert position based on drop target and effective level.
      // The position calculation in calculateInsertPos handles all cases including:
      // - Moving to new position (before/after target)
      // - Level changes (nesting deeper or promoting shallower)
      // - H1 special cases (must be at document root)

      // Process node: update level and extract children that are shallower than new level
      const { node: nodeToInsert, extracted } = processHeadingForLevelChange(
        source.node,
        effectiveLevel,
        schema
      )

      // Log for debugging
      console.info('[DragEnd] ===== MOVE =====')
      console.info('[DragEnd] Source:', {
        id: activeItem.id,
        level: originalLevel,
        pos: source.pos,
        end: source.end
      })
      console.info('[DragEnd] Target:', {
        id: dropTarget.id,
        level: target.level,
        pos: target.pos,
        end: target.end
      })
      console.info('[DragEnd] Level:', { from: originalLevel, to: effectiveLevel, diff: levelDiff })
      console.info('[DragEnd] Drop:', {
        position: dropTarget.position,
        insertPos,
        reason
      })
      if (extracted.length > 0) {
        console.info('[DragEnd] Extracted:', extracted.length, 'children as siblings')
      }

      // Execute transaction
      const { tr } = editor.state

      if (source.pos < insertPos) {
        // Source before insert: delete first, then insert at mapped position
        tr.delete(source.pos, source.end)
        const mappedInsertPos = tr.mapping.map(insertPos)
        tr.insert(mappedInsertPos, nodeToInsert)
        // Insert extracted children after the main node
        let afterPos = tr.mapping.map(mappedInsertPos) + nodeToInsert.nodeSize
        for (const child of extracted) {
          tr.insert(afterPos, child)
          afterPos += child.nodeSize
        }
      } else {
        // Source after insert: insert first, then delete at mapped position
        tr.insert(insertPos, nodeToInsert)
        // Insert extracted children after the main node
        let afterPos = insertPos + nodeToInsert.nodeSize
        for (const child of extracted) {
          tr.insert(afterPos, child)
          afterPos += child.nodeSize
        }
        tr.delete(tr.mapping.map(source.pos), tr.mapping.map(source.end))
      }

      tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
      editor.view.dispatch(tr)

      requestAnimationFrame(() => {
        document
          .querySelector(`.heading[data-id="${activeItem.id}"]`)
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
