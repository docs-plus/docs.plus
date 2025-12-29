/**
 * Programmatic heading move utility for Cypress tests
 * Replicates the logic from useTocDrag handleDragEnd
 */

import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { TIPTAP_EVENTS } from '@types'

// =============================================================================
// TYPES
// =============================================================================

interface HeadingNode {
  pos: number
  end: number
  level: number
  node: ProseMirrorNode
  contentEnd: number
}

interface InsertResult {
  pos: number
  reason: string
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

function findContainingH1(headings: HeadingNode[], pos: number): HeadingNode | null {
  return headings.find((h) => h.level === 1 && h.pos <= pos && h.end > pos) ?? null
}

function findStackAttachParent(
  headings: HeadingNode[],
  referencePos: number,
  effectiveLevel: number
): HeadingNode | null {
  let parent: HeadingNode | null = null

  for (const h of headings) {
    if (h.level < effectiveLevel && h.pos <= referencePos && h.end > referencePos) {
      parent = h
    }
  }

  return parent
}

function findDirectChildContaining(
  headings: HeadingNode[],
  parent: HeadingNode,
  target: HeadingNode
): HeadingNode | null {
  const contentStart = parent.pos + (parent.node.firstChild?.nodeSize ?? 0) + 1
  const contentEnd = parent.contentEnd

  for (const h of headings) {
    if (h.pos > contentStart && h.pos < contentEnd) {
      const hParent = findStackAttachParent(headings, h.pos, h.level)
      if (hParent && hParent.pos === parent.pos) {
        if (h.pos <= target.pos && h.end >= target.end) {
          return h
        }
      }
    }
  }

  return null
}

function calculateInsertPos(
  doc: ProseMirrorNode,
  target: HeadingNode,
  effectiveLevel: number,
  dropPosition: 'before' | 'after'
): InsertResult {
  const allHeadings = getAllHeadings(doc)

  // H1 special case
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

  // Nesting inside target (after only)
  if (dropPosition === 'after' && effectiveLevel > target.level) {
    return {
      pos: target.contentEnd,
      reason: `after: nesting inside H${target.level}`
    }
  }

  // Sibling before target
  if (dropPosition === 'before' && effectiveLevel > target.level) {
    return {
      pos: target.pos,
      reason: `before: sibling of H${target.level}`
    }
  }

  // Find STACK-ATTACH parent
  const referencePos = dropPosition === 'before' ? target.pos : target.end
  const parent = findStackAttachParent(allHeadings, referencePos, effectiveLevel)

  if (!parent) {
    return {
      pos: dropPosition === 'before' ? target.pos : target.end,
      reason: 'No parent found (fallback)'
    }
  }

  const parentContentStart = parent.pos + (parent.node.firstChild?.nodeSize ?? 0) + 1
  const parentContentEnd = parent.contentEnd

  // Target is the parent
  if (target.pos === parent.pos) {
    if (dropPosition === 'before') {
      return { pos: parentContentStart, reason: `before parent: first child of H${parent.level}` }
    } else {
      return { pos: parentContentEnd, reason: `after parent: last child of H${parent.level}` }
    }
  }

  // Target inside parent
  if (dropPosition === 'before') {
    if (target.pos >= parentContentStart && target.end <= parent.end) {
      const directChild = findDirectChildContaining(allHeadings, parent, target)
      if (directChild && directChild.pos !== target.pos) {
        return { pos: directChild.pos, reason: `before: at sibling boundary` }
      }
      return { pos: target.pos, reason: `before: at target.pos inside H${parent.level}` }
    }
    return { pos: parentContentStart, reason: `before: at parent contentStart` }
  }

  // After
  if (target.pos >= parentContentStart && target.end <= parent.end) {
    const directChild = findDirectChildContaining(allHeadings, parent, target)
    if (directChild && directChild.pos !== target.pos) {
      return { pos: directChild.end, reason: `after: at sibling boundary` }
    }
    return { pos: target.end, reason: `after: at target.end inside H${parent.level}` }
  }

  return { pos: parentContentEnd, reason: `after: at parent contentEnd` }
}

function processHeadingForLevelChange(
  node: ProseMirrorNode,
  newLevel: number,
  schema: Schema
): { node: ProseMirrorNode; extracted: ProseMirrorNode[] } {
  const json = node.toJSON()
  const extracted: any[] = []

  if (json.type === 'heading' && typeof json.attrs?.level === 'number') {
    json.attrs = { ...json.attrs, level: newLevel }

    if (json.content?.[0]?.type === 'contentHeading') {
      json.content[0] = {
        ...json.content[0],
        attrs: { ...json.content[0].attrs, level: newLevel }
      }
    }

    if (json.content?.[1]?.type === 'contentWrapper') {
      const contentWrapper = json.content[1]
      const keptChildren: any[] = []

      for (const child of contentWrapper.content || []) {
        if (child.type === 'heading' && typeof child.attrs?.level === 'number') {
          if (child.attrs.level <= newLevel) {
            extracted.push(child)
          } else {
            keptChildren.push(child)
          }
        } else {
          keptChildren.push(child)
        }
      }

      json.content[1] = { ...contentWrapper, content: keptChildren }
    }
  }

  return {
    node: schema.nodeFromJSON(json),
    extracted: extracted.map((e) => schema.nodeFromJSON(e))
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Programmatically move a heading by IDs.
 * This is the same logic as handleDragEnd in useTocDrag.
 */
export function moveHeadingById(
  editor: Editor,
  sourceId: string,
  targetId: string,
  position: 'before' | 'after',
  newLevel?: number
): boolean {
  const doc = editor.state.doc
  const schema = editor.state.schema

  const source = findHeadingById(doc, sourceId)
  const target = findHeadingById(doc, targetId)

  if (!source || !target) {
    console.warn('[moveHeadingById] Could not find source or target', { sourceId, targetId })
    return false
  }

  const originalLevel = source.level
  const effectiveLevel = newLevel ?? originalLevel
  const levelDiff = effectiveLevel - originalLevel

  // SAFETY: Prevent moving a heading inside itself (circular nesting)
  if (target.pos >= source.pos && target.end <= source.end) {
    console.warn('[moveHeadingById] Cannot move heading inside itself', {
      source: { pos: source.pos, end: source.end },
      target: { pos: target.pos, end: target.end }
    })
    return false
  }

  // Check for no-op
  const isSamePosition =
    levelDiff === 0 &&
    ((position === 'after' && source.pos === target.end) ||
      (position === 'before' && source.end === target.pos))

  if (isSamePosition) {
    console.log('[moveHeadingById] No-op, same position')
    return true
  }

  // Calculate insert position
  const { pos: insertPos, reason } = calculateInsertPos(doc, target, effectiveLevel, position)

  // SAFETY: Validate insert position is within document bounds
  if (insertPos < 0 || insertPos > doc.content.size) {
    console.warn('[moveHeadingById] Invalid insert position', {
      insertPos,
      docSize: doc.content.size
    })
    return false
  }

  // Process node
  const { node: nodeToInsert, extracted } = processHeadingForLevelChange(
    source.node,
    effectiveLevel,
    schema
  )

  console.info('[moveHeadingById] Moving:', {
    source: { id: sourceId, level: originalLevel, pos: source.pos, end: source.end },
    target: { id: targetId, level: target.level, pos: target.pos, end: target.end },
    effectiveLevel,
    position,
    insertPos,
    reason,
    extractedCount: extracted.length
  })

  // Execute transaction with try-catch for safety
  try {
    const { tr } = editor.state

    if (source.pos < insertPos) {
      // Source is before insert point: delete first, then insert
      tr.delete(source.pos, source.end)
      const mappedInsertPos = tr.mapping.map(insertPos)

      // Validate mapped position
      if (mappedInsertPos < 0 || mappedInsertPos > tr.doc.content.size) {
        console.warn('[moveHeadingById] Mapped insert position out of range', { mappedInsertPos })
        return false
      }

      tr.insert(mappedInsertPos, nodeToInsert)
      let afterPos = tr.mapping.map(mappedInsertPos) + nodeToInsert.nodeSize
      for (const child of extracted) {
        tr.insert(afterPos, child)
        afterPos += child.nodeSize
      }
    } else {
      // Source is after insert point: insert first, then delete
      tr.insert(insertPos, nodeToInsert)
      let afterPos = insertPos + nodeToInsert.nodeSize
      for (const child of extracted) {
        tr.insert(afterPos, child)
        afterPos += child.nodeSize
      }
      tr.delete(tr.mapping.map(source.pos), tr.mapping.map(source.end))
    }

    tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
    editor.view.dispatch(tr)
  } catch (error) {
    console.error('[moveHeadingById] Transaction failed:', error)
    return false
  }

  return true
}
