import { type ProseMirrorNode,TIPTAP_NODES, type Transaction } from '@types'

interface HeadingInfo {
  pos: number
  level: number
  endPos: number
  contentWrapperPos: number
  contentWrapperEndPos: number
}

/**
 * Validates and fixes heading hierarchy according to HN-10 rules:
 * - H1 cannot be nested inside any heading
 * - Child level must be > parent level
 *
 * Call this after any heading manipulation to ensure schema compliance.
 */
export const validateAndFixHeadingHierarchy = (tr: Transaction): Transaction => {
  let hasChanges = true
  let iterations = 0
  const MAX_ITERATIONS = 10 // Prevent infinite loops

  while (hasChanges && iterations < MAX_ITERATIONS) {
    hasChanges = false
    iterations++

    const violations = findHierarchyViolations(tr.doc)

    for (const violation of violations) {
      if (violation.type === 'h1-nested') {
        // H1 cannot be nested - extract it to document root
        extractH1ToRoot(tr, violation)
        hasChanges = true
        break // Re-scan after modification
      } else if (violation.type === 'invalid-child-level') {
        // Child level <= parent level - extract the child
        extractInvalidChild(tr, violation)
        hasChanges = true
        break // Re-scan after modification
      }
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error('[validateHeadingHierarchy] Max iterations reached, possible infinite loop')
  }

  return tr
}

interface HierarchyViolation {
  type: 'h1-nested' | 'invalid-child-level'
  childPos: number
  childLevel: number
  childEndPos: number
  parentPos: number
  parentLevel: number
  parentEndPos: number
}

/**
 * Finds all hierarchy violations in the document
 */
function findHierarchyViolations(doc: ProseMirrorNode): HierarchyViolation[] {
  const violations: HierarchyViolation[] = []
  const headingStack: HeadingInfo[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) return

    const level = node.firstChild?.attrs?.level || 1
    const endPos = pos + node.nodeSize
    const contentWrapperPos = pos + (node.firstChild?.nodeSize || 0) + 1
    const contentWrapperEndPos = endPos - 1

    // Pop stack until we find a valid parent (level < current)
    while (headingStack.length > 0) {
      const parent = headingStack[headingStack.length - 1]
      if (pos >= parent.endPos) {
        headingStack.pop()
      } else {
        break
      }
    }

    // Check for violations
    if (headingStack.length > 0) {
      const parent = headingStack[headingStack.length - 1]

      // Rule: H1 cannot be nested
      if (level === 1) {
        violations.push({
          type: 'h1-nested',
          childPos: pos,
          childLevel: level,
          childEndPos: endPos,
          parentPos: parent.pos,
          parentLevel: parent.level,
          parentEndPos: parent.endPos
        })
      }
      // Rule: Child level must be > parent level
      else if (level <= parent.level) {
        violations.push({
          type: 'invalid-child-level',
          childPos: pos,
          childLevel: level,
          childEndPos: endPos,
          parentPos: parent.pos,
          parentLevel: parent.level,
          parentEndPos: parent.endPos
        })
      }
    }

    headingStack.push({
      pos,
      level,
      endPos,
      contentWrapperPos,
      contentWrapperEndPos
    })
  })

  return violations
}

/**
 * Extracts a nested H1 to the document root (after its current containing H1)
 */
function extractH1ToRoot(tr: Transaction, violation: HierarchyViolation): void {
  const { childPos, childEndPos, parentPos, parentEndPos } = violation

  // Find the root H1 that contains this nested H1
  let rootH1EndPos = parentEndPos
  let _searchPos = parentPos

  tr.doc.nodesBetween(0, parentPos, (node, pos) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const level = node.firstChild?.attrs?.level || 1
      if (level === 1 && pos + node.nodeSize > parentPos) {
        rootH1EndPos = pos + node.nodeSize
      }
    }
  })

  // Get the node to move
  const nodeToMove = tr.doc.slice(childPos, childEndPos)

  // Delete from current position
  tr.delete(childPos, childEndPos)

  // Insert after the root H1
  const mappedInsertPos = tr.mapping.map(rootH1EndPos)
  tr.insert(mappedInsertPos, nodeToMove.content)

  console.info(
    `[validateHeadingHierarchy] Extracted nested H1 from pos ${childPos} to ${mappedInsertPos}`
  )
}

/**
 * Extracts a child heading that has invalid level (≤ parent level)
 * and makes it a sibling after the parent
 */
function extractInvalidChild(tr: Transaction, violation: HierarchyViolation): void {
  const { childPos, childEndPos, parentEndPos } = violation

  // Get the node to move
  const nodeToMove = tr.doc.slice(childPos, childEndPos)

  // Delete from current position
  tr.delete(childPos, childEndPos)

  // Insert after the parent heading
  const mappedInsertPos = tr.mapping.map(parentEndPos)
  tr.insert(mappedInsertPos, nodeToMove.content)

  console.info(
    `[validateHeadingHierarchy] Extracted invalid child (level ${violation.childLevel}) from parent (level ${violation.parentLevel})`
  )
}

/**
 * Checks if document has any hierarchy violations without fixing them
 */
export const hasHierarchyViolations = (doc: ProseMirrorNode): boolean => {
  return findHierarchyViolations(doc).length > 0
}

/**
 * Gets a list of all hierarchy violations for debugging
 */
export const getHierarchyViolations = (doc: ProseMirrorNode): HierarchyViolation[] => {
  return findHierarchyViolations(doc)
}

export default validateAndFixHeadingHierarchy
