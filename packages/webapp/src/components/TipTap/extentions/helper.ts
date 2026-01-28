import { TextSelection } from '@tiptap/pm/state'
import {
  TIPTAP_NODES,
  TIPTAP_EVENTS,
  type EditorState,
  type ProseMirrorNode,
  type Schema,
  type Transaction
} from '@types'
import {
  HeadingBlockInfo,
  SelectionBlock,
  BlockMap,
  PrevBlockResult,
  NodeState,
  HeadingPosition,
  InsertHeadingsParams,
  LastH1Inserted,
  InsertHeadingsByNodeBlocksResult,
  HeadingAttributes
} from './types'

/**
 * Get a list of previous headings within a specified range in the document.
 */
export const getPrevHeadingList = (
  tr: Transaction,
  start: number,
  from: number,
  startPos: number = 0
): HeadingBlockInfo[] => {
  if (from < start) {
    throw new Error(
      `[Heading]: Invalid position range. 'from' (${from}) is less than 'start' (${start}). startPos: ${startPos}`
    )
  }

  const titleHMap: HeadingBlockInfo[] = []

  try {
    tr.doc.nodesBetween(start, from, function (node, pos) {
      if (startPos > 0 && pos < startPos) return
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        const headingLevel = node.firstChild?.attrs?.level
        const depth = tr.doc.resolve(pos).depth

        titleHMap.push({
          le: headingLevel,
          node: node.toJSON(),
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize
        })
      }
    })
  } catch (error) {
    console.error('[Heading]: Error in getPrevHeadingList', error, { tr, start, from })
  }

  return titleHMap
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
  let firstHEading = true
  let prevDepth = 0
  const selectedContents: SelectionBlock[] = []

  doc.nodesBetween(start, end, (node, pos, parent) => {
    if (pos < start || !parent) return

    const nodeType = node.type.name
    const isContentWrapper = parent.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
    const isHeadingNode = nodeType === TIPTAP_NODES.HEADING_TYPE

    if (firstHEading && !isHeadingNode && isContentWrapper) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isHeadingNode) {
      firstHEading = false
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
 * Returns a map of headings and the blocks that fall under them
 */
export const getHeadingsBlocksMap = (
  doc: ProseMirrorNode,
  start: number,
  end: number
): HeadingBlockInfo[] => {
  const titleHMap: HeadingBlockInfo[] = []

  const newEnd = Math.min(end, doc.content.size)

  doc.nodesBetween(start, newEnd, function (node, pos, parent, index) {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      titleHMap.push({
        le: headingLevel,
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        endContentPos: pos + node.content.size,
        index
      })
    }
  })

  return titleHMap
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
    ancesster: {
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

export const getNodeState = (headingId: string): NodeState => {
  try {
    const headingMap = JSON.parse(localStorage.getItem('headingMap') || '[]')
    return headingMap.find((h: NodeState) => h.headingId === headingId) || { crinkleOpen: true }
  } catch (error) {
    console.error('Error parsing headingMap from localStorage:', error)
    return { crinkleOpen: true }
  }
}

export const getPrevHeadingPos = (
  doc: ProseMirrorNode,
  startPos: number,
  endPos: number
): HeadingPosition => {
  let prevHStartPos = 0
  let prevHEndPos = 0

  // Ensure endPos doesn't exceed document size
  const newEndPos = Math.min(endPos, doc.content.size)
  doc?.nodesBetween(startPos, newEndPos, function (node, pos) {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const depth = doc.resolve(pos).depth
      // INFO: this the trick I've looking for
      if (depth === 2) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  return { prevHStartPos, prevHEndPos }
}

/**
 * Finds the previous block based on the heading level and determines whether it should be nested.
 *
 * STACK-ATTACH algorithm: Walk up until you find an ancestor with a STRICTLY LOWER level.
 * The incoming heading becomes the last child of that ancestor.
 */
export const findPrevBlock = (
  mapHPost: HeadingBlockInfo[],
  headingLevel: number
): PrevBlockResult => {
  if (mapHPost.length === 0) {
    console.error('[Heading][findPrevBlock] no mapHPost')
    return { prevBlock: null, shouldNested: false }
  }

  // STACK-ATTACH: Find the last block with a level STRICTLY LESS than the heading level
  // This means headingLevel will become a child of prevBlock
  const prevBlock = mapHPost.findLast((x) => x.le < headingLevel)

  if (!prevBlock) {
    // No parent found with lower level - insert as sibling of first block
    // This can happen when pasting same-level or shallower headings
    return { prevBlock: mapHPost[mapHPost.length - 1], shouldNested: false }
  }

  // Found a parent - heading will be nested inside it
  return { prevBlock, shouldNested: true }
}

export const extractParagraphsAndHeadings = (
  clipboardContents: SelectionBlock[]
): [SelectionBlock[], any[]] => {
  const paragraphs: SelectionBlock[] = []
  const headings: any[] = []
  let heading: any = null

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
        endBlockPos: node.endBlockPos,
        startBlockPos: node.startBlockPos,
        level: node.level,
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
      heading?.content.at(1).content.push(node)
    }
  }

  if (heading) {
    headings.push(heading)
  }

  return [paragraphs, headings]
}

/**
 * Inserts remaining headings from clipboard content into the document
 */
export const insertRemainingHeadings = ({
  state,
  tr,
  headings,
  titleStartPos,
  titleEndPos,
  prevHStartPos: _prevHStartPos
}: InsertHeadingsParams): boolean => {
  if (!headings.length) {
    console.info('[Heading][insertRemainingHeadings] no headings to insert')
    return true
  }

  let mapHPost = getHeadingsBlocksMap(tr.doc, titleStartPos, titleEndPos)

  // if the first heading is not h1, then we need to filter the mapHPost to only include headings that are before the current selection
  if (mapHPost.length > 1 && headings.at(0).le !== 1) {
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
    )
  }

  for (const heading of headings) {
    const comingLevel = heading.level || heading.le || heading.content.at(0).level
    mapHPost = getPrevHeadingList(
      tr,
      mapHPost.at(0)!.startBlockPos,
      mapHPost.length === 1 && mapHPost.at(0)!.le === 1
        ? mapHPost.at(0)!.endBlockPos
        : Math.max(tr.mapping.map(mapHPost.at(0)!.endBlockPos), mapHPost.at(0)!.endBlockPos)
    )

    const prevHBlock = getPrevHeadingPos(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))

    mapHPost = mapHPost.filter((x) => x.startBlockPos >= prevHBlock.prevHStartPos)

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

    const node = state.schema.nodeFromJSON(heading)

    tr.insert(prevBlock!.endBlockPos - (shouldNested ? 2 : 0), node)

    // notify that new heading was created, for update TOC
    tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
  }

  return true
}

export const putTextSelectionEndNode = (
  tr: Transaction,
  insertPos: number,
  headingNode: ProseMirrorNode[]
): TextSelection => {
  const firstHeading = headingNode.at(0)
  const firstHeadingChild = firstHeading?.firstChild
  const firstChildNodeSize = firstHeadingChild?.nodeSize || 0

  const updatedSelection = new TextSelection(tr.doc.resolve(insertPos + firstChildNodeSize))

  return updatedSelection
}

/**
 * Recursively finds paragraphs within a node and pushes them to the newContent array.
 */
const findParagraphs = (currentNode: ProseMirrorNode, newContent: any[]): void => {
  currentNode.forEach((childNode) => {
    if (childNode.type.name === TIPTAP_NODES.PARAGRAPH_TYPE) {
      newContent.push(childNode.toJSON())
    } else if (childNode.childCount > 0) {
      findParagraphs(childNode, newContent)
    }
  })
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
  const headings: any[] = []
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

        let newContent: any[] = []
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
      const selectLastHeadingContent = headings.at(-1).content.at(-1).content
      // remove all empty paragraph
      selectLastHeadingContent.pop()
      selectLastHeadingContent.push(...contentWrapper)
    }
  } else {
    let node = doc.nodeAt(start)
    let nodeJson: any = null
    if (!node || state.selection.toJSON().type === TIPTAP_NODES.TEXT_TYPE) {
      nodeJson = state.selection.$anchor.parent.toJSON()
    } else {
      nodeJson = node.toJSON()
    }
    const jsonNode: any = {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: {
        level: attributes.level
      },
      content: [
        {
          type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
          attrs: {
            level: attributes.level
          }
        },
        {
          type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
          content: contentWrapper
        }
      ]
    }

    if (nodeJson?.content && Array.isArray(nodeJson.content)) {
      jsonNode.content.at(0)!.content = [...nodeJson.content]
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
  let firstHEading = true
  let prevDepth = 0
  const selectedContents: SelectionBlock[] = []
  const sResolve = doc.resolve(start)

  if (sResolve.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    // TODO: handle this case later
    throw new Error('Selection starts within a content heading')
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

    if (firstHEading && isContentWrapper && nodeType !== TIPTAP_NODES.HEADING_TYPE) {
      let contentObject: SelectionBlock = {
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        node,
        ...node.toJSON()
      }

      selectedContents.push(contentObject)
    } else if (nodeType === TIPTAP_NODES.HEADING_TYPE) {
      firstHEading = false
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
    let firstNode = selectedContents.at(0)!
    const newposfor = newStart + sResolve.parentOffset
    const newContent = firstNode.node!.cut(newposfor - firstNode.startBlockPos)
    selectedContents.at(0)!.content = newContent.content.toJSON()
    selectedContents.at(0)!.startBlockPos = newStart
  }

  return selectedContents
}

/**
 * Creates a ProseMirror node from a JSON representation using the provided schema
 */
export const createNodeFromJSON = (node: any, schema: Schema): ProseMirrorNode =>
  schema.nodeFromJSON(node)

/**
 * Flattens heading nodes into a single array
 * Handles both ProseMirror nodes (with .child() method) and plain JSON objects
 */
export const linearizeHeadingNodes = (headings: ProseMirrorNode[]): ProseMirrorNode[] => {
  const flatHeadings: ProseMirrorNode[] = []

  headings.forEach((heading) => {
    // Handle both ProseMirror nodes and plain objects
    if (!heading || !heading.content) {
      console.warn('[linearizeHeadingNodes] Invalid heading:', heading)
      return
    }

    let headingTitleNode: any
    let contentWrapperNodes: any

    // Check if it's a ProseMirror node (has .child method) or plain object
    if (typeof heading.content.child === 'function') {
      // ProseMirror Fragment
      headingTitleNode = heading.content.child(0)
      const contentWrapper = heading.content.child(1)
      contentWrapperNodes = contentWrapper?.content
    } else if (Array.isArray(heading.content as any)) {
      // Plain array (from JSON)
      headingTitleNode = (heading.content as any)[0]
      const contentWrapper = (heading.content as any)[1]
      contentWrapperNodes = contentWrapper?.content
    } else {
      console.warn('[linearizeHeadingNodes] Unexpected content structure:', heading.content)
      return
    }

    if (headingTitleNode) {
      flatHeadings.push(headingTitleNode)
    }

    if (contentWrapperNodes) {
      // Handle both Fragment.forEach and array iteration
      if (typeof contentWrapperNodes.forEach === 'function') {
        contentWrapperNodes.forEach((node: ProseMirrorNode) => flatHeadings.push(node))
      } else if (Array.isArray(contentWrapperNodes)) {
        contentWrapperNodes.forEach((node: any) => flatHeadings.push(node))
      }
    }
  })

  return flatHeadings
}

/**
 * Transforms clipboard content into structured document format
 */
export const transformClipboardToStructured = (
  clipboardContents: any[],
  { schema }: { schema: Schema }
): [ProseMirrorNode[], ProseMirrorNode[]] => {
  const paragraphs: ProseMirrorNode[] = []
  const headings: ProseMirrorNode[] = []
  let currentHeading: any = null

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
      currentHeading?.content[1].content.push(node)
    }
  })

  // Push the last heading into the headings array if it exists
  if (currentHeading) {
    headings.push(createNodeFromJSON(currentHeading, schema))
  }

  return [paragraphs, headings]
}

/**
 * Adjusts heading levels in pasted content to respect the target context.
 *
 * HN-10 Rule: Child level must be > parent level.
 * This function shifts heading levels so they're valid within the paste target.
 *
 * @param headingsJson - Array of heading JSON objects to adjust
 * @param targetContextLevel - The level of the heading that will be the parent (0 for document root)
 * @param schema - The ProseMirror schema
 * @returns Object with adjusted headings and any H1s that should go to document root
 */
export const adjustHeadingLevelsForContext = (
  headingsJson: any[],
  targetContextLevel: number,
  schema: Schema
): { adjustedHeadings: ProseMirrorNode[]; h1Headings: ProseMirrorNode[] } => {
  if (headingsJson.length === 0) {
    return { adjustedHeadings: [], h1Headings: [] }
  }

  const adjustedHeadings: ProseMirrorNode[] = []
  const h1Headings: ProseMirrorNode[] = []

  // Find the minimum level in pasted content
  const levels = headingsJson.map((h) => {
    const level = h.content?.[0]?.attrs?.level || h.attrs?.level || 1
    return level
  })
  const minLevel = Math.min(...levels)

  // Calculate offset: we want minLevel to become targetContextLevel + 1
  // But if targetContextLevel is 0 (doc root), minLevel should become 1
  const requiredMinLevel = targetContextLevel === 0 ? 1 : targetContextLevel + 1
  const levelOffset = requiredMinLevel - minLevel

  for (const headingJson of headingsJson) {
    const originalLevel = headingJson.content?.[0]?.attrs?.level || headingJson.attrs?.level || 1
    const adjustedLevel = Math.min(10, Math.max(1, originalLevel + levelOffset))

    // H1s after adjustment should go to document root
    if (adjustedLevel === 1 && targetContextLevel > 0) {
      // This heading wants to be H1 but we're pasting inside a section
      // Keep it as H1 and extract to document root
      h1Headings.push(createNodeFromJSON(headingJson, schema))
      continue
    }

    // Create adjusted heading JSON - MUST update BOTH heading.attrs.level AND contentHeading.attrs.level
    const adjustedJson = {
      ...headingJson,
      attrs: { ...headingJson.attrs, level: adjustedLevel }, // FIX: Update parent heading level
      content: headingJson.content?.map((child: any, index: number) => {
        if (index === 0 && child.type === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
          return {
            ...child,
            attrs: { ...child.attrs, level: adjustedLevel }
          }
        }
        return child
      })
    }

    adjustedHeadings.push(createNodeFromJSON(adjustedJson, schema))
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

/**
 * Inserts heading nodes into the document at their appropriate positions
 */
export const insertHeadingsByNodeBlocks = (
  tr: Transaction,
  headings: ProseMirrorNode[],
  lastBlockPos: number,
  lastH1Inserted: LastH1Inserted,
  from: number,
  titleStartPos: number,
  prevHStartPos: number
): InsertHeadingsByNodeBlocksResult => {
  let mapHPost: HeadingBlockInfo[] = []

  // Iterate over each heading and insert it into the correct position
  headings.forEach((heading) => {
    const comingLevel = heading.attrs.level || heading.content.firstChild!.attrs.level
    const startBlock = lastH1Inserted.startBlockPos
    const nodeAtStart = tr.doc.nodeAt(lastH1Inserted.startBlockPos)
    const endBlock =
      lastH1Inserted.endBlockPos === 0
        ? tr.mapping.map(from)
        : nodeAtStart!.content.size + lastH1Inserted.startBlockPos

    // Get the map of headings blocks within the specified range
    mapHPost = getHeadingsBlocksMap(tr.doc, startBlock, endBlock).filter(
      (x) => x.startBlockPos >= (comingLevel === 1 ? titleStartPos : prevHStartPos)
    )

    // Find the previous block and determine if it should be nested
    let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

    // Find the last occurrence of the previous block level if there are duplicates
    const robob = mapHPost.filter((x) => prevBlock?.le === x?.le)

    if (robob.length > 1) prevBlock = robob.at(-1)!
    lastBlockPos = prevBlock?.endBlockPos || lastBlockPos

    // Update the previous heading start position if the previous block is at depth 2
    if (prevBlock && prevBlock.depth === 2) {
      prevHStartPos = prevBlock.startBlockPos
    }

    const insertPos = lastBlockPos - (shouldNested ? 2 : 0)

    // Insert the heading at the appropriate position
    tr.insert(insertPos, heading)

    // Update the position of the last H1 heading inserted
    if (comingLevel === 1) {
      lastH1Inserted.startBlockPos = lastBlockPos
      lastH1Inserted.endBlockPos = tr.mapping.map(lastBlockPos + heading.content.size)
    }
  })

  return { lastBlockPos, prevHStartPos }
}

const removeBoldMark = (node: any): any => {
  if (!node.marks) return node
  return {
    ...node,
    marks: node.marks.filter((mark: any) => mark.type !== 'bold')
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
