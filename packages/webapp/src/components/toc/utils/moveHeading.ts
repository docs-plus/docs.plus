/**
 * Programmatic heading move utility for Cypress tests
 * Replicates the logic from useTocDrag handleDragEnd (flat schema)
 */

import { computeSection, moveSection } from '@components/TipTap/extensions/shared'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TIPTAP_EVENTS } from '@types'

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

// =============================================================================
// HELPER FUNCTIONS (FLAT SCHEMA)
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

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export function moveHeadingById(
  editor: Editor,
  sourceId: string,
  targetId: string,
  position: 'before' | 'after',
  newLevel?: number
): boolean {
  const doc = editor.state.doc

  const source = findHeadingById(doc, sourceId)
  const target = findHeadingById(doc, targetId)

  if (!source || !target) {
    console.warn('[moveHeadingById] Could not find source or target', { sourceId, targetId })
    return false
  }

  const originalLevel = source.level
  const effectiveLevel = newLevel ?? originalLevel
  const levelDiff = effectiveLevel - originalLevel

  if (target.sectionFrom >= source.sectionFrom && target.sectionTo <= source.sectionTo) {
    console.warn('[moveHeadingById] Cannot move heading inside itself')
    return false
  }

  const isSamePosition =
    levelDiff === 0 &&
    ((position === 'after' && source.sectionTo === target.sectionTo) ||
      (position === 'before' && source.sectionFrom === target.sectionFrom))

  if (isSamePosition) {
    console.info('[moveHeadingById] No-op, same position')
    return true
  }

  const insertPos = position === 'before' ? target.sectionFrom : target.sectionTo

  if (insertPos < 0 || insertPos > doc.content.size) {
    console.warn('[moveHeadingById] Invalid insert position', {
      insertPos,
      docSize: doc.content.size
    })
    return false
  }

  console.info('[moveHeadingById] Moving:', {
    source: { id: sourceId, level: originalLevel, section: [source.sectionFrom, source.sectionTo] },
    target: { id: targetId, level: target.level, section: [target.sectionFrom, target.sectionTo] },
    effectiveLevel,
    position,
    insertPos
  })

  try {
    const { tr } = editor.state

    moveSection(tr, doc, source.sectionFrom, source.sectionTo, insertPos)

    if (levelDiff !== 0) {
      let headingPos: number
      if (source.sectionFrom < insertPos) {
        const sectionSize = source.sectionTo - source.sectionFrom
        headingPos = tr.mapping.map(insertPos) - sectionSize
      } else {
        headingPos = insertPos
      }

      const node = tr.doc.nodeAt(headingPos)
      if (node?.type.name === 'heading') {
        tr.setNodeMarkup(headingPos, null, { ...node.attrs, level: effectiveLevel })
      }
    }

    tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
    editor.view.dispatch(tr)
  } catch (error) {
    console.error('[moveHeadingById] Transaction failed:', error)
    return false
  }

  return true
}
