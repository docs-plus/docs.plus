import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { type ProseMirrorNode, TIPTAP_NODES, type Transaction } from '@types'
import { logger } from '@utils/logger'

interface HeadingInfo {
  pos: number
  level: number
  endPos: number
  contentWrapperPos: number
  contentWrapperEndPos: number
}

const sliceContainsHeadingNode = (step: ReplaceStep | ReplaceAroundStep): boolean => {
  let containsHeading = false
  step.slice.content.descendants((node) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      containsHeading = true
      return false
    }
    return true
  })
  return containsHeading
}

const isTextOnlySlice = (step: ReplaceStep | ReplaceAroundStep): boolean => {
  if (step.slice.content.childCount === 0) return true

  let isTextOnly = true
  step.slice.content.descendants((node) => {
    if (!node.isText) {
      isTextOnly = false
      return false
    }
    return true
  })
  return isTextOnly
}

/**
 * Fast-path guard: determines whether a transaction can affect heading hierarchy.
 *
 * We skip full hierarchy scans for plain text insertions because they cannot
 * create/repair structural heading violations.
 */
export const transactionMayAffectHierarchy = (tr: Transaction): boolean => {
  if (!tr.docChanged) return false

  return tr.steps.some((step) => {
    if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) {
      return true
    }

    if (step.from !== step.to) {
      // Text-only deletions/replacements within inline content cannot
      // reshape heading structure. Heading minimum nodeSize is ~8, so
      // small ranges with empty/text-only slices are guaranteed to stay
      // within a single text block.
      const rangeSize = step.to - step.from
      if (rangeSize < 8 && (step.slice.content.size === 0 || isTextOnlySlice(step))) {
        return false
      }
      // Large deletions/replacements may remove or restructure headings
      // even if the replacement slice contains no headings.
      return true
    }

    if (sliceContainsHeadingNode(step)) {
      return true
    }

    return !isTextOnlySlice(step)
  })
}

/**
 * Validates and fixes heading hierarchy according to HN-10 rules:
 * - H1 cannot be nested inside any heading
 * - Child level must be > parent level
 *
 * When a changed range is provided, the first scan is scoped to the
 * enclosing H1 sections. After each fix (which moves nodes), subsequent
 * scans fall back to full-document to catch any cascading violations.
 */
export const validateAndFixHeadingHierarchy = (
  tr: Transaction,
  changedFrom?: number,
  changedTo?: number
): Transaction => {
  let hasChanges = true
  let iterations = 0
  const MAX_ITERATIONS = 10

  while (hasChanges && iterations < MAX_ITERATIONS) {
    hasChanges = false
    iterations++

    // Scope the first iteration to the affected section range.
    // After a fix moves nodes, positions shift — fall back to full-doc.
    const range =
      iterations === 1 && changedFrom !== undefined && changedTo !== undefined
        ? getEnclosingSectionRange(tr.doc, changedFrom, changedTo)
        : undefined
    const violations = findHierarchyViolations(tr.doc, range?.from, range?.to)

    for (const violation of violations) {
      let fixed = false

      if (violation.type === 'h1-nested') {
        fixed = extractH1ToRoot(tr, violation)
      } else if (violation.type === 'invalid-child-level') {
        fixed = extractInvalidChild(tr, violation)
      }

      if (fixed) {
        hasChanges = true
        break
      }

      if (!fixed && violation.type) {
        logger.warn('[validateHeadingHierarchy] Aborting fix loop — cannot safely restructure')
        hasChanges = false
        break
      }
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    logger.error('[validateHeadingHierarchy] Max iterations reached, possible infinite loop')
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
 * Finds all hierarchy violations in the document.
 * Uses selective descent — only enters doc and contentWrapper nodes,
 * skipping paragraphs, lists, and text nodes entirely.
 *
 * When a range is provided, scans only that section of the document.
 */
function findHierarchyViolations(
  doc: ProseMirrorNode,
  from?: number,
  to?: number
): HierarchyViolation[] {
  const violations: HierarchyViolation[] = []
  const headingStack: HeadingInfo[] = []

  const visitor = (node: ProseMirrorNode, pos: number): boolean | void => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) {
      return node.type.name === 'doc' || node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    }

    const level = node.firstChild?.attrs?.level || 1
    const endPos = pos + node.nodeSize
    const contentWrapperPos = pos + (node.firstChild?.nodeSize || 0) + 1
    const contentWrapperEndPos = endPos - 1

    while (headingStack.length > 0) {
      const parent = headingStack[headingStack.length - 1]
      if (pos >= parent.endPos) {
        headingStack.pop()
      } else {
        break
      }
    }

    if (headingStack.length > 0) {
      const parent = headingStack[headingStack.length - 1]

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
      } else if (level <= parent.level) {
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

    return true
  }

  if (from !== undefined && to !== undefined) {
    doc.nodesBetween(from, to, visitor)
  } else {
    doc.descendants(visitor)
  }

  return violations
}

/**
 * Extracts a nested H1 to the document root (after its current containing H1).
 *
 * Uses ReplaceStep via maybeStep to avoid intermediate invalid states —
 * tr.delete() + tr.insert() can leave a contentWrapper with content that
 * violates its spec (e.g. interleaved blocks/headings), causing
 * contentMatchAt to throw on the subsequent insert.
 */
function extractH1ToRoot(tr: Transaction, violation: HierarchyViolation): boolean {
  const { childPos, childEndPos, parentPos, parentEndPos } = violation

  let rootH1EndPos = parentEndPos

  tr.doc.nodesBetween(0, parentPos, (node, pos) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const level = node.firstChild?.attrs?.level || 1
      if (level === 1 && pos < parentPos && pos + node.nodeSize > parentPos) {
        rootH1EndPos = pos + node.nodeSize
      }
    }
  })

  try {
    const nodeToMove = tr.doc.slice(childPos, childEndPos)
    tr.delete(childPos, childEndPos)
    const mappedInsertPos = tr.mapping.map(rootH1EndPos)
    tr.insert(mappedInsertPos, nodeToMove.content)
    logger.info(
      `[validateHeadingHierarchy] Extracted nested H1 from pos ${childPos} to ${mappedInsertPos}`
    )
    return true
  } catch {
    logger.warn(
      '[validateHeadingHierarchy] extractH1ToRoot failed — intermediate state has invalid content, skipping fix'
    )
    return false
  }
}

/**
 * Extracts a child heading that has invalid level (≤ parent level)
 * and makes it a sibling after the parent.
 *
 * Wrapped in try/catch because tr.delete() can leave a contentWrapper
 * in a state where its content no longer matches (block)* heading*,
 * causing the subsequent tr.insert() to throw via contentMatchAt.
 */
function extractInvalidChild(tr: Transaction, violation: HierarchyViolation): boolean {
  const { childPos, childEndPos, parentEndPos } = violation

  try {
    const nodeToMove = tr.doc.slice(childPos, childEndPos)
    tr.delete(childPos, childEndPos)
    const mappedInsertPos = tr.mapping.map(parentEndPos)
    tr.insert(mappedInsertPos, nodeToMove.content)
    logger.info(
      `[validateHeadingHierarchy] Extracted invalid child (level ${violation.childLevel}) from parent (level ${violation.parentLevel})`
    )
    return true
  } catch {
    logger.warn(
      '[validateHeadingHierarchy] extractInvalidChild failed — intermediate state has invalid content, skipping fix'
    )
    return false
  }
}

/**
 * Checks if document has any hierarchy violations without fixing them.
 * Bail-early: stops scanning on the first violation found.
 * Only descends into nodes that can contain headings (doc, contentWrapper),
 * skipping paragraphs, lists, and text nodes entirely.
 *
 * When a changed range is provided, scans only the top-level H1 sections
 * overlapping that range instead of the full document.
 */
export const hasHierarchyViolations = (
  doc: ProseMirrorNode,
  changedFrom?: number,
  changedTo?: number
): boolean => {
  const headingStack: { pos: number; level: number; endPos: number }[] = []
  let found = false

  const visitor = (node: ProseMirrorNode, pos: number): boolean | void => {
    if (found) return false

    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) {
      return node.type.name === 'doc' || node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    }

    const level = node.firstChild?.attrs?.level || 1
    const endPos = pos + node.nodeSize

    while (headingStack.length > 0 && pos >= headingStack[headingStack.length - 1].endPos) {
      headingStack.pop()
    }

    if (headingStack.length > 0) {
      const parent = headingStack[headingStack.length - 1]
      if (level === 1 || level <= parent.level) {
        found = true
        return false
      }
    }

    headingStack.push({ pos, level, endPos })
    return true
  }

  if (changedFrom !== undefined && changedTo !== undefined) {
    const { from, to } = getEnclosingSectionRange(doc, changedFrom, changedTo)
    doc.nodesBetween(from, to, visitor)
  } else {
    doc.descendants(visitor)
  }

  return found
}

/**
 * Finds the start/end positions of the top-level H1 sections that
 * enclose the given range. Used to scope hierarchy checks.
 */
const getEnclosingSectionRange = (
  doc: ProseMirrorNode,
  changedFrom: number,
  changedTo: number
): { from: number; to: number } => {
  let from = 0
  let to = doc.content.size

  doc.forEach((node, offset) => {
    const sectionEnd = offset + node.nodeSize
    if (offset <= changedFrom && sectionEnd > changedFrom) {
      from = offset
    }
    if (offset <= changedTo && sectionEnd > changedTo) {
      to = sectionEnd
    }
  })

  return { from, to }
}

/**
 * Gets a list of all hierarchy violations for debugging
 */
export const getHierarchyViolations = (doc: ProseMirrorNode): HierarchyViolation[] => {
  return findHierarchyViolations(doc)
}

export default validateAndFixHeadingHierarchy
