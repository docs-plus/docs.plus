import { type ProseMirrorNode, type Schema, TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import { JSONNode, SelectionBlock } from '../types'

type LinearizedHeadingNode = ProseMirrorNode | JSONNode

export const isProseMirrorNode = (node: unknown): node is ProseMirrorNode => {
  return Boolean(node) && typeof (node as ProseMirrorNode).toJSON === 'function'
}

export const asJsonNodeArray = (value: unknown): JSONNode[] => {
  if (!Array.isArray(value)) return []
  return value as JSONNode[]
}

const toJsonNodeFromSelectionBlock = (block: SelectionBlock): JSONNode => ({
  type: block.type,
  attrs: block.attrs,
  content: block.content,
  text: block.text,
  marks: block.marks
})

const toHeadingLevel = (value: unknown, fallback: number = 1): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const getHeadingLevelFromJson = (headingJson: JSONNode): number => {
  const childLevel = headingJson.content?.[0]?.attrs?.level
  const attrsLevel = headingJson.attrs?.level
  return toHeadingLevel(childLevel ?? attrsLevel, 1)
}

export const extractParagraphsAndHeadings = (
  clipboardContents: SelectionBlock[]
): [SelectionBlock[], JSONNode[]] => {
  const paragraphs: SelectionBlock[] = []
  const headings: JSONNode[] = []
  let heading: JSONNode | null = null

  for (const node of clipboardContents) {
    if (!heading && !node.level) {
      paragraphs.push(node)
    }

    if (node.level) {
      if (heading) {
        headings.push(heading)
        heading = null
      }
      heading = {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: node.level },
        content: [
          {
            type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
            attrs: { level: node.level },
            content: node.content
          },
          {
            type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
            content: []
          }
        ]
      }
    } else {
      if (heading?.content && heading.content[1]) {
        const wrapperNode = heading.content[1]
        wrapperNode.content = asJsonNodeArray(wrapperNode.content)
        wrapperNode.content.push(toJsonNodeFromSelectionBlock(node))
      }
    }
  }

  if (heading) {
    headings.push(heading)
  }

  return [paragraphs, headings]
}

/**
 * Creates a ProseMirror node from a JSON representation using the provided schema
 */
export const createNodeFromJSON = (node: JSONNode, schema: Schema): ProseMirrorNode =>
  schema.nodeFromJSON(node)

/**
 * Flattens heading nodes into a single array
 * Handles both ProseMirror nodes (with .child() method) and plain JSON objects
 */
export const linearizeHeadingNodes = (
  headings: LinearizedHeadingNode[]
): LinearizedHeadingNode[] => {
  const flatHeadings: LinearizedHeadingNode[] = []

  headings.forEach((heading) => {
    // Handle both ProseMirror nodes and plain JSON nodes
    if (!heading) {
      logger.warn('[linearizeHeadingNodes] Invalid heading:', heading)
      return
    }

    let headingTitleNode: LinearizedHeadingNode | null = null
    let contentWrapperNodes: LinearizedHeadingNode[] = []

    if (isProseMirrorNode(heading)) {
      if (heading.childCount < 2) {
        logger.warn(
          '[linearizeHeadingNodes] Incomplete ProseMirror heading node:',
          heading.toJSON()
        )
        return
      }
      headingTitleNode = heading.child(0)
      const contentWrapper = heading.child(1)
      contentWrapper.content.forEach((node) => contentWrapperNodes.push(node))
    } else if (Array.isArray(heading.content)) {
      headingTitleNode = heading.content[0] ?? null
      const contentWrapper = heading.content[1]
      contentWrapperNodes = asJsonNodeArray(contentWrapper?.content)
    } else {
      logger.warn(
        '[linearizeHeadingNodes] Unexpected content structure:',
        heading as unknown as Record<string, unknown>
      )
      return
    }

    if (headingTitleNode) {
      flatHeadings.push(headingTitleNode)
    }

    contentWrapperNodes.forEach((node) => flatHeadings.push(node))
  })

  return flatHeadings
}

/**
 * Transforms clipboard content into structured document format
 */
export const transformClipboardToStructured = (
  clipboardContents: JSONNode[],
  { schema }: { schema: Schema }
): [ProseMirrorNode[], ProseMirrorNode[]] => {
  const paragraphs: ProseMirrorNode[] = []
  const headings: ProseMirrorNode[] = []
  let currentHeading: JSONNode | null = null

  // Iterate through clipboard contents and categorize nodes as paragraphs or headings
  clipboardContents.forEach((node) => {
    // If no heading is found and the node is not a heading type, treat it as a paragraph
    if (!currentHeading && node.type !== TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      paragraphs.push(createNodeFromJSON(node, schema))
    } else if (node.type === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      // If a new heading is found, push the previous heading into the heading list and reset the heading
      if (currentHeading) {
        headings.push(createNodeFromJSON(currentHeading, schema))
      }
      currentHeading = {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { ...node?.attrs, id: null },
        content: [
          node,
          {
            type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
            content: []
          }
        ]
      }
    } else {
      // If the node is not a heading, append it to the current heading's content
      if (currentHeading?.content && currentHeading.content[1]) {
        const wrapperNode = currentHeading.content[1]
        wrapperNode.content = asJsonNodeArray(wrapperNode.content)
        wrapperNode.content.push(node)
      }
    }
  })

  // Push the last heading into the headings array if it exists
  if (currentHeading) {
    headings.push(createNodeFromJSON(currentHeading, schema))
  }

  return [paragraphs, headings]
}

/**
 * Applies a new level to a heading JSON node, updating both heading.attrs.level
 * and contentHeading.attrs.level (the first child).
 */
const applyLevelToHeadingJson = (headingJson: JSONNode, level: number): JSONNode => ({
  ...headingJson,
  attrs: { ...headingJson.attrs, level },
  content: headingJson.content?.map((child: JSONNode, index: number) => {
    if (index === 0 && child.type === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      return { ...child, attrs: { ...child.attrs, level } }
    }
    return child
  })
})

/**
 * Adjusts heading levels in pasted content to respect the target context.
 *
 * HN-10 Rule: Child level must be > parent level.
 * This function shifts heading levels so they're valid within the paste target.
 *
 * When pasting inside a section (targetContextLevel > 0) and the content
 * contains H1 headings, H1s are extracted along with their subtree — all
 * subsequent headings until the next H1 stay grouped with their H1 parent.
 * This preserves document ordering: the H1 and its children are inserted
 * together as a complete section, not scattered.
 *
 * @param headingsJson - Array of heading JSON objects to adjust
 * @param targetContextLevel - The level of the heading that will be the parent (0 for document root)
 * @param schema - The ProseMirror schema
 * @returns Object with adjusted headings and any H1 trees that should go to document root
 */
export const adjustHeadingLevelsForContext = (
  headingsJson: JSONNode[],
  targetContextLevel: number,
  schema: Schema
): { adjustedHeadings: ProseMirrorNode[]; h1Headings: ProseMirrorNode[] } => {
  if (headingsJson.length === 0) {
    return { adjustedHeadings: [], h1Headings: [] }
  }

  const adjustedHeadings: ProseMirrorNode[] = []
  const h1Headings: ProseMirrorNode[] = []

  // At document root — no H1 extraction, just normalize levels so min becomes 1
  if (targetContextLevel === 0) {
    const levels = headingsJson.map((h) => getHeadingLevelFromJson(h))
    const minLevel = Math.min(...levels)
    const levelOffset = 1 - minLevel

    for (const headingJson of headingsJson) {
      const originalLevel = getHeadingLevelFromJson(headingJson)
      const adjustedLevel = Math.min(10, Math.max(1, originalLevel + levelOffset))
      adjustedHeadings.push(
        createNodeFromJSON(applyLevelToHeadingJson(headingJson, adjustedLevel), schema)
      )
    }

    return { adjustedHeadings, h1Headings }
  }

  // targetContextLevel > 0: extract H1s WITH their subtrees.
  //
  // Group headings into:
  //   - beforeFirstH1: headings before any H1 → adjusted for context, inserted at cursor
  //   - h1Groups: each H1 + all subsequent non-H1 headings → built as complete tree
  //
  // This prevents the ordering inversion where H1 children (e.g., "Coding", "Search")
  // get separated from their H1 parent ("MiniMax M2.5…") and end up above it.
  const beforeFirstH1: JSONNode[] = []
  const h1Groups: JSONNode[][] = []
  let currentH1Group: JSONNode[] | null = null

  for (const headingJson of headingsJson) {
    const level = getHeadingLevelFromJson(headingJson)

    if (level === 1) {
      if (currentH1Group) h1Groups.push(currentH1Group)
      currentH1Group = [headingJson]
    } else if (currentH1Group) {
      currentH1Group.push(headingJson)
    } else {
      beforeFirstH1.push(headingJson)
    }
  }
  if (currentH1Group) h1Groups.push(currentH1Group)

  // Build complete trees for each H1 group via STACK-ATTACH
  for (const group of h1Groups) {
    const tree = buildHeadingTree(group)
    for (const root of tree) {
      h1Headings.push(createNodeFromJSON(root, schema))
    }
  }

  // Adjust levels for headings that appeared before the first H1
  if (beforeFirstH1.length > 0) {
    const levels = beforeFirstH1.map((h) => getHeadingLevelFromJson(h))
    const minLevel = Math.min(...levels)
    const requiredMinLevel = targetContextLevel + 1
    const levelOffset = requiredMinLevel - minLevel

    for (const headingJson of beforeFirstH1) {
      const originalLevel = getHeadingLevelFromJson(headingJson)
      const adjustedLevel = Math.min(10, Math.max(1, originalLevel + levelOffset))
      adjustedHeadings.push(
        createNodeFromJSON(applyLevelToHeadingJson(headingJson, adjustedLevel), schema)
      )
    }
  }

  return { adjustedHeadings, h1Headings }
}

/**
 * Gets the context level for paste operation based on cursor position.
 * Returns the level of the containing heading, or 0 if at document root.
 */
export const getPasteContextLevel = (doc: ProseMirrorNode, pos: number): number => {
  let contextLevel = 0

  doc.descendants((node, nodePos) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const nodeEndPos = nodePos + node.nodeSize
      if (pos > nodePos && pos < nodeEndPos) {
        const level = node.firstChild?.attrs?.level || 1
        // We're inside this heading's contentWrapper
        contextLevel = Math.max(contextLevel, level)
      }
    }
  })

  return contextLevel
}

const removeBoldMark = (node: JSONNode): JSONNode => {
  if (!node.marks) return node
  return {
    ...node,
    marks: node.marks.filter((mark) => mark.type !== 'bold')
  }
}

const convertContentBlockToParagraph = (contentBlock: SelectionBlock): SelectionBlock => {
  if (!contentBlock.level) return contentBlock

  return {
    ...contentBlock,
    type: TIPTAP_NODES.PARAGRAPH_TYPE,
    content: contentBlock.content?.map(removeBoldMark) || contentBlock.content
  }
}

export const convertHeadingsToParagraphs = (contentBlocks: SelectionBlock[]): SelectionBlock[] => {
  if (!Array.isArray(contentBlocks)) return []
  return contentBlocks.map(convertContentBlockToParagraph)
}

/**
 * Builds a nested heading tree from a flat array of heading JSON nodes
 * using the HN-10 §5 STACK-ATTACH algorithm.
 *
 * Each heading is attached as a child of the nearest ancestor whose level
 * is strictly less than the current heading's level. Headings with no
 * valid parent become roots.
 *
 * Child headings are appended to their parent's contentWrapper (content[1]).
 */
export const buildHeadingTree = (flatHeadings: JSONNode[]): JSONNode[] => {
  if (flatHeadings.length === 0) return []

  const roots: JSONNode[] = []
  const stack: { node: JSONNode; level: number }[] = []

  for (const heading of flatHeadings) {
    const level = getHeadingLevelFromJson(heading)

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node
      const wrapper = parent.content?.[1]
      if (wrapper) {
        wrapper.content = asJsonNodeArray(wrapper.content)
        wrapper.content.push(heading)
      }
    } else {
      roots.push(heading)
    }

    stack.push({ node: heading, level })
  }

  return roots
}
