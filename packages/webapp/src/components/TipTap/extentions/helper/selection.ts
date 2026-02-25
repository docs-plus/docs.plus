import { type EditorState, type ProseMirrorNode, TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import { BlockMap, HeadingAttributes, JSONNode, SelectionBlock } from '../types'

const toJsonNodeFromSelectionBlock = (block: SelectionBlock): JSONNode => ({
  type: block.type,
  attrs: block.attrs,
  content: block.content,
  text: block.text,
  marks: block.marks
})

const isProseMirrorNodeWithCut = (
  node: SelectionBlock['node']
): node is ProseMirrorNode & { cut: (from: number, to?: number) => ProseMirrorNode } => {
  return Boolean(node) && typeof (node as ProseMirrorNode).cut === 'function'
}

/**
 * Get selection blocks from a Prosemirror document.
 */
export const getSelectionBlocks = (
  doc: ProseMirrorNode,
  start: number,
  end: number,
  includeContentHeading: boolean = false,
  range: boolean = false
): SelectionBlock[] => {
  const selectedContents: SelectionBlock[] = []
  const processNode = (node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null) => {
    if (!parent) return
    const depth = doc.resolve(pos).depth
    const isContentWrapper = parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    const isContentHeading = node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE

    if (isContentWrapper && node.type.name !== TIPTAP_NODES.HEADING_TYPE) {
      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isContentHeading) {
      selectedContents.push({
        depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : TIPTAP_NODES.PARAGRAPH_TYPE,
        content: node.toJSON().content
      })
    }
  }

  if (range) {
    doc.descendants(processNode)
  } else {
    doc.nodesBetween(start, end, (node, pos, parent) => {
      if (pos >= start && parent) {
        processNode(node, pos, parent)
      }
    })
  }

  return selectedContents
}

export const getSelectionRangeBlocks = (
  doc: ProseMirrorNode,
  start: number,
  end: number,
  includeContentHeading: boolean = false
): SelectionBlock[] => {
  const selectedContents: SelectionBlock[] = []

  const processNode = (node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null) => {
    if (!node.isBlock || !parent) return
    const isContentWrapper = parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    const isContentHeading = node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE

    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE && isContentWrapper) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isContentHeading) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : TIPTAP_NODES.PARAGRAPH_TYPE,
        content: node.toJSON().content
      })
    }
  }

  doc.nodesBetween(start, end, processNode)

  return selectedContents
}

/**
 * Get range blocks from a document
 */
export const getRangeBlocks = (
  doc: ProseMirrorNode,
  start: number,
  end: number
): SelectionBlock[] => {
  let isFirstHeading = true
  let prevDepth = 0
  const selectedContents: SelectionBlock[] = []

  doc.nodesBetween(start, end, (node, pos, parent) => {
    if (pos < start || !parent) return

    const nodeType = node.type.name
    const isContentWrapper = parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    const isHeadingNode = nodeType === TIPTAP_NODES.HEADING_TYPE

    if (isFirstHeading && !isHeadingNode && isContentWrapper) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isHeadingNode) {
      isFirstHeading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        prevDepth = depth

        selectedContents.push({
          le: headingLevel,
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
      }
    }
  })

  return selectedContents
}

/**
 * Creates a block map of the editor state.
 */
export const createThisBlockMap = (state: EditorState): BlockMap => {
  const { selection } = state
  const { $from, $to } = selection
  const { depth } = $from.blockRange($to)!

  const caretSelectionTextBlock = getSelectionTextNode(state)
  return {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1)
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1
    },
    ancestor: {
      start: $from.start(1),
      end: $from.end(1)
    },
    end: $from.end(depth),
    start: $from.start(depth),
    nextLevel: 0,
    depth,
    headingContent: caretSelectionTextBlock,
    empty: {
      type: TIPTAP_NODES.PARAGRAPH_TYPE
    },
    paragraph: { type: TIPTAP_NODES.PARAGRAPH_TYPE }
  }
}

export const getEndPosSelection = (doc: ProseMirrorNode, state: EditorState): number => {
  const { $from, $to, from, to } = state.selection
  const { start: _start, end } = $from.blockRange($to)!

  const startPos =
    from === to
      ? end
      : isMultipleSelection(doc, from, to)
        ? end
        : from + doc?.nodeAt(from)!.nodeSize

  return startPos
}

// This is a temporary fix for detecting multiple selections.
// I haven't found a better solution yet.
// Heads-up: selecting text by dragging the cursor works differently than double-clicking or tapping on a line.
export const isMultipleSelection = (doc: ProseMirrorNode, start: number, end: number): boolean => {
  const textBetween = doc.textBetween(start, end, '-/||/-')
  const textBetweenArray = textBetween.split('-/||/-').filter((item) => item.trim() !== '')
  return textBetweenArray.length > 1
}

/**
 * Recursively finds paragraphs within a node and pushes them to the newContent array.
 */
const findParagraphs = (currentNode: ProseMirrorNode, newContent: JSONNode[]): void => {
  currentNode.forEach((childNode) => {
    if (childNode.type.name === TIPTAP_NODES.PARAGRAPH_TYPE) {
      newContent.push(childNode.toJSON())
    } else if (childNode.childCount > 0) {
      findParagraphs(childNode, newContent)
    }
  })
}

/**
 * Create heading nodes from selection
 */
export const createHeadingNodeFromSelection = (
  doc: ProseMirrorNode,
  state: EditorState,
  start: number,
  end: number,
  attributes: HeadingAttributes,
  block: BlockMap,
  contentWrapper: SelectionBlock[]
): ProseMirrorNode[] => {
  const headings: JSONNode[] = []
  const { $from, $to } = state.selection

  if (isMultipleSelection(doc, start, end)) {
    const mResolve = doc.resolve(start)

    let { start: newStart } = $from.blockRange($to)!

    // find the contentWrapper node position of the current(start) selection
    let contentWrapperPos = mResolve.pos
    while (contentWrapperPos > 0) {
      const node = doc.nodeAt(contentWrapperPos)
      if (node && node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
        break
      }
      contentWrapperPos--
    }

    // if the newStart is not a block, then we need to find the parent block position
    const newStartNode = doc.nodeAt(newStart)
    if (newStartNode && !newStartNode.isBlock) {
      const $newStart = doc.resolve(newStart)
      const parentPos = $newStart.before($newStart.depth)
      const parentNode = doc.nodeAt(parentPos)
      if (parentNode && parentNode.isBlock) {
        newStart = parentPos
      }
    }

    doc.nodesBetween(
      newStart,
      end,
      function (node, pos, parent) {
        if (
          !parent ||
          !(
            node.isBlock &&
            parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE &&
            node.type.name !== TIPTAP_NODES.HEADING_TYPE
          )
        )
          return

        let newContent: JSONNode[] = []
        if (node.type.name !== TIPTAP_NODES.PARAGRAPH_TYPE) {
          findParagraphs(node, newContent)
        }

        const newHeading = {
          type: TIPTAP_NODES.HEADING_TYPE,
          attrs: {
            level: attributes.level
          },
          content: [
            {
              type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
              content: newContent.length ? newContent : node.content.toJSON(),
              attrs: {
                level: attributes.level
              }
            },
            {
              type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
              content: [
                {
                  type: TIPTAP_NODES.PARAGRAPH_TYPE
                }
              ]
            }
          ]
        }

        headings.push(newHeading)
      },
      newStart
    )

    // put the contentWrapper(rest paragraph nodes) in the last heading
    if (contentWrapper.length && headings.length) {
      const lastHeading = headings.at(-1)
      const lastHeadingContentWrapper = lastHeading?.content?.at(-1)
      if (lastHeadingContentWrapper) {
        lastHeadingContentWrapper.content = lastHeadingContentWrapper.content || []
        // remove all empty paragraph
        lastHeadingContentWrapper.content.pop()
        lastHeadingContentWrapper.content.push(
          ...contentWrapper.map((block) => toJsonNodeFromSelectionBlock(block))
        )
      }
    }
  } else {
    let node = doc.nodeAt(start)
    let nodeJson: JSONNode | null = null
    if (!node || state.selection.toJSON().type === TIPTAP_NODES.TEXT_TYPE) {
      nodeJson = state.selection.$anchor.parent.toJSON()
    } else {
      nodeJson = node.toJSON()
    }
    const jsonNodeContent: JSONNode[] = [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: {
          level: attributes.level
        }
      },
      {
        type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
        content: contentWrapper.map((block) => toJsonNodeFromSelectionBlock(block))
      }
    ]

    const jsonNode: JSONNode = {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: {
        level: attributes.level
      },
      content: jsonNodeContent
    }

    if (nodeJson?.content && Array.isArray(nodeJson.content) && jsonNodeContent[0]) {
      jsonNodeContent[0].content = [...nodeJson.content]
    }

    headings.push(jsonNode)
  }

  return headings.map((x) => state.schema.nodeFromJSON(x))
}

export const getSelectionTextNode = (state: EditorState): { type: string; text: string } => {
  const { selection, doc } = state
  const { $from, $to, $anchor } = selection

  return {
    type: TIPTAP_NODES.TEXT_TYPE,
    text:
      doc.textBetween($from.pos, $to.pos, ' ') ||
      doc?.nodeAt($anchor.pos)?.text ||
      $anchor.nodeBefore?.text ||
      ' '
  }
}

/**
 * Get selection range slice
 */
export const getSelectionRangeSlice = (
  doc: ProseMirrorNode,
  state: EditorState,
  start: number,
  end: number
): SelectionBlock[] => {
  let isFirstHeadingSeen = true
  let prevDepth = 0
  const selectedContents: SelectionBlock[] = []
  const sResolve = doc.resolve(start)

  if (sResolve.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    logger.warn(
      '[getSelectionRangeSlice] Selection starts within a contentHeading — returning empty'
    )
    return []
  }

  let newStart = start - sResolve.parentOffset

  let contentWrapperPos = sResolve.pos
  while (contentWrapperPos > 0) {
    const node = doc.nodeAt(contentWrapperPos)
    if (node && node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
      break
    }
    contentWrapperPos--
  }

  const newStartNode = doc.nodeAt(newStart)
  if (newStartNode && !newStartNode.isBlock) {
    const $newStart = doc.resolve(newStart)
    const parentPos = $newStart.before($newStart.depth)
    const parentNode = doc.nodeAt(parentPos)
    if (parentNode && parentNode.isBlock) {
      newStart = parentPos
    }
  }

  doc.nodesBetween(newStart, end, function (node, pos, parent, _index) {
    if (pos < contentWrapperPos || !parent) return
    if (!node.isBlock) return

    const isContentWrapper = parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    const nodeType = node.type.name

    if (isFirstHeadingSeen && isContentWrapper && nodeType !== TIPTAP_NODES.HEADING_TYPE) {
      let contentObject: SelectionBlock = {
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        node,
        ...node.toJSON()
      }

      selectedContents.push(contentObject)
    } else if (nodeType === TIPTAP_NODES.HEADING_TYPE) {
      isFirstHeadingSeen = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        prevDepth = depth

        selectedContents.push({
          le: headingLevel,
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
      }
    }
  })

  if (sResolve.parentOffset > 0 && selectedContents.length) {
    const firstNode = selectedContents.at(0)!
    if (!isProseMirrorNodeWithCut(firstNode.node)) return selectedContents
    const newposfor = newStart + sResolve.parentOffset
    const newContent = firstNode.node!.cut(newposfor - firstNode.startBlockPos)
    selectedContents.at(0)!.content = newContent.content.toJSON()
    selectedContents.at(0)!.startBlockPos = newStart
  }

  return selectedContents
}

/**
 * Determines whether a selection covers the entire editable document content
 * by resolving positions structurally rather than relying on magic offsets
 * like `2` / `docSize - 3` which break under different nesting depths.
 */
export const isEntireDocumentSelected = (
  doc: ProseMirrorNode,
  anchorPos: number,
  headPos: number
): boolean => {
  const firstPos = getFirstEditablePosition(doc)
  const lastPos = getLastEditablePosition(doc)
  if (firstPos === -1 || lastPos === -1) return false

  const lo = Math.min(anchorPos, headPos)
  const hi = Math.max(anchorPos, headPos)
  return lo <= firstPos && hi >= lastPos
}

const getFirstEditablePosition = (doc: ProseMirrorNode): number => {
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (pos !== -1) return false
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      pos = nodePos + 1
      return false
    }
    return true
  })
  return pos
}

const getLastEditablePosition = (doc: ProseMirrorNode): number => {
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (node.isBlock && node.type.name !== TIPTAP_NODES.DOC_TYPE) {
      const endPos = nodePos + node.content.size
      if (endPos > pos) pos = endPos
    }
  })
  return pos
}

/**
 * Structurally determines whether a text position falls inside the document's
 * first contentHeading (the title of the very first heading node).
 *
 * Replaces the fragile magic-number check `from === 2` which assumed a fixed
 * nesting depth of doc > heading > contentHeading.
 */
export const isFirstHeadingInDocument = (doc: ProseMirrorNode, pos: number): boolean => {
  const firstHeading = doc.firstChild
  if (!firstHeading || firstHeading.type.name !== TIPTAP_NODES.HEADING_TYPE) return false

  const firstContentHeading = firstHeading.firstChild
  if (!firstContentHeading || firstContentHeading.type.name !== TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    return false
  }

  // doc(0) > heading(1) > contentHeading(2) ... contentHeading ends at 2 + contentHeading.nodeSize
  const contentHeadingStart = 2
  const contentHeadingEnd = contentHeadingStart + firstContentHeading.nodeSize
  return pos >= contentHeadingStart && pos < contentHeadingEnd
}

/**
 * Finds the end position of the root-level H1 section that contains `pos`.
 * Returns the H1's nodeSize (relative to doc start) for insertion after that section.
 * If no root H1 contains the position, returns doc.content.size (doc end).
 */
export const findRootH1EndPos = (doc: ProseMirrorNode, pos: number): number => {
  let offset = 0
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i)
    const childEnd = offset + child.nodeSize
    if (pos >= offset && pos < childEnd) {
      return childEnd
    }
    offset = childEnd
  }
  return doc.content.size
}
