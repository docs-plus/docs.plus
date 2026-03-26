/**
 * Schema Migration: Nested → Flat heading structure
 *
 * Old schema: doc > heading > contentHeading (inline*) + contentWrapper (block*)
 * New schema: doc > heading (inline*) block*
 *
 * The transform recursively flattens the nested tree into sibling nodes.
 * It is idempotent — already-flat documents pass through unchanged.
 */

interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  text?: string
  marks?: unknown[]
}

/**
 * Check if a PM JSON document uses the old nested heading schema.
 * Returns true if any node has type 'contentHeading' or 'contentWrapper'.
 */
export function isOldSchema(doc: PMNode): boolean {
  if (!doc.content) return false

  function hasNestedTypes(node: PMNode): boolean {
    if (node.type === 'contentHeading' || node.type === 'contentWrapper') return true
    if (node.content) {
      return node.content.some(hasNestedTypes)
    }
    return false
  }

  return doc.content.some(hasNestedTypes)
}

/**
 * Normalize heading attribute keys to the new schema convention.
 * Old: attrs.id or attrs['data-toc-id']  →  New: attrs['toc-id']
 */
function normalizeHeadingAttrs(
  attrs: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!attrs) return {}

  const normalized: Record<string, unknown> = { ...attrs }

  const tocId = normalized['toc-id'] ?? normalized['data-toc-id'] ?? normalized['id']
  delete normalized['data-toc-id']
  delete normalized['id']
  if (tocId) {
    normalized['toc-id'] = tocId
  }

  // Clamp level to 1-6 range
  if (typeof normalized.level === 'number') {
    normalized.level = Math.max(1, Math.min(6, normalized.level))
  }

  return normalized
}

/**
 * Flatten a single old-schema heading node into a flat heading + its body content.
 * Returns an array of nodes (the heading itself + any flattened body content).
 */
function flattenHeading(node: PMNode): PMNode[] {
  if (node.type !== 'heading') return [node]

  // Already flat: heading has inline content directly (no contentHeading child)
  const hasContentHeading = node.content?.some((c) => c.type === 'contentHeading')
  if (!hasContentHeading) {
    return [{ ...node, attrs: normalizeHeadingAttrs(node.attrs) }]
  }

  const contentHeading = node.content?.find((c) => c.type === 'contentHeading')
  const contentWrapper = node.content?.find((c) => c.type === 'contentWrapper')

  // Build the flat heading: same attrs (level, toc-id) + inline content from contentHeading
  const level = contentHeading?.attrs?.level ?? node.attrs?.level ?? 1
  const tocId =
    node.attrs?.['toc-id'] ??
    node.attrs?.['data-toc-id'] ??
    node.attrs?.id ??
    contentHeading?.attrs?.id ??
    contentHeading?.attrs?.['data-toc-id']

  const flatHeading: PMNode = {
    type: 'heading',
    attrs: normalizeHeadingAttrs({ level, 'toc-id': tocId }),
    content: contentHeading?.content ?? []
  }

  const result: PMNode[] = [flatHeading]

  // Recursively flatten contentWrapper children
  if (contentWrapper?.content) {
    for (const child of contentWrapper.content) {
      result.push(...flattenNode(child))
    }
  }

  return result
}

/**
 * Recursively flatten a single node. Headings get flattened;
 * other block nodes have their content recursively processed.
 */
function flattenNode(node: PMNode): PMNode[] {
  if (node.type === 'heading') {
    return flattenHeading(node)
  }

  // For non-heading blocks, recursively process children
  // (handles lists, blockquotes, etc. that might theoretically contain headings)
  if (node.content) {
    const newContent: PMNode[] = []
    for (const child of node.content) {
      if (child.type === 'heading') {
        // Heading inside a non-heading container: extract and flatten at this level
        newContent.push(...flattenHeading(child))
      } else {
        newContent.push({
          ...child,
          content: child.content ? flattenContentRecursive(child.content) : undefined
        })
      }
    }
    return [{ ...node, content: newContent }]
  }

  return [node]
}

function flattenContentRecursive(content: PMNode[]): PMNode[] {
  const result: PMNode[] = []
  for (const child of content) {
    if (child.type === 'heading') {
      result.push(...flattenHeading(child))
    } else if (child.content) {
      result.push({
        ...child,
        content: flattenContentRecursive(child.content)
      })
    } else {
      result.push(child)
    }
  }
  return result
}

/**
 * Transform an old nested-schema PM JSON document into the new flat schema.
 * Idempotent: if the doc is already flat, returns it unchanged.
 */
export function transformNestedToFlat(doc: PMNode): PMNode {
  if (!doc.content) return doc
  if (!isOldSchema(doc)) return doc

  const flatContent: PMNode[] = []

  for (const topNode of doc.content) {
    flatContent.push(...flattenNode(topNode))
  }

  return { ...doc, content: flatContent }
}
