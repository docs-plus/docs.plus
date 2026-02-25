import { TextSelection } from '@tiptap/pm/state'
import { type ProseMirrorNode, TIPTAP_EVENTS, TIPTAP_NODES, type Transaction } from '@types'
import { logger } from '@utils/logger'

import {
  HeadingBlockInfo,
  HeadingPosition,
  HeadingTraversalMetrics,
  InsertHeadingsByNodeBlocksResult,
  InsertHeadingsParams,
  JSONNode,
  LastH1Inserted,
  PrevBlockResult,
  SelectionBlock
} from '../types'

type HeadingLike = InsertHeadingsParams['headings'][number]

const incrementMetric = (
  metrics: HeadingTraversalMetrics | undefined,
  key: keyof HeadingTraversalMetrics
) => {
  if (!metrics) return
  metrics[key] += 1
}

const toHeadingLevel = (value: unknown, fallback: number = 1): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const isSelectionHeadingBlock = (heading: HeadingLike): heading is SelectionBlock => {
  return (
    typeof heading === 'object' &&
    heading !== null &&
    'startBlockPos' in heading &&
    'endBlockPos' in heading
  )
}

const getHeadingLevel = (heading: HeadingLike): number => {
  if (isSelectionHeadingBlock(heading)) {
    if (typeof heading.level === 'number') return heading.level
    if (typeof heading.le === 'number') return heading.le
  }

  const childLevel = heading.content?.[0]?.attrs?.level
  const attrsLevel = heading.attrs?.level
  return toHeadingLevel(childLevel ?? attrsLevel, 1)
}

const toHeadingJson = (heading: HeadingLike): JSONNode =>
  isSelectionHeadingBlock(heading)
    ? {
        type: heading.type,
        attrs: heading.attrs,
        content: heading.content,
        text: heading.text,
        marks: heading.marks
      }
    : heading

/**
 * Get a list of previous headings within a specified range in the document.
 */
export const getPrevHeadingList = (
  tr: Transaction,
  start: number,
  from: number,
  startPos: number = 0,
  traversalMetrics?: HeadingTraversalMetrics
): HeadingBlockInfo[] => {
  if (from < start) {
    throw new Error(
      `[Heading]: Invalid position range. 'from' (${from}) is less than 'start' (${start}). startPos: ${startPos}`
    )
  }

  const titleHMap: HeadingBlockInfo[] = []
  incrementMetric(traversalMetrics, 'headingWindowScans')

  try {
    tr.doc.nodesBetween(start, from, function (node, pos) {
      if (startPos > 0 && pos < startPos) return
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        incrementMetric(traversalMetrics, 'headingNodesVisited')
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
    logger.error('[Heading]: Error in getPrevHeadingList', error, { tr, start, from })
  }

  return titleHMap
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

export const getPrevHeadingPos = (
  doc: ProseMirrorNode,
  startPos: number,
  endPos: number,
  traversalMetrics?: HeadingTraversalMetrics
): HeadingPosition => {
  incrementMetric(traversalMetrics, 'topLevelBoundaryScans')
  let prevHStartPos = 0
  let prevHEndPos = 0

  const newEndPos = Math.min(endPos, doc.content.size)
  doc?.nodesBetween(startPos, newEndPos, function (node, pos) {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const $pos = doc.resolve(pos)
      const isDirectChildOfRootHeading =
        $pos.depth >= 1 && $pos.node($pos.depth - 1).type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE
      if (isDirectChildOfRootHeading) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  return { prevHStartPos, prevHEndPos }
}

const getLatestTopLevelStartPos = (
  headingsMap: HeadingBlockInfo[],
  fallbackStartPos: number
): number => {
  const minDepth = headingsMap.length > 0 ? Math.min(...headingsMap.map((h) => h.depth)) : Infinity
  for (let index = headingsMap.length - 1; index >= 0; index--) {
    if (headingsMap[index].depth === minDepth) {
      return headingsMap[index].startBlockPos
    }
  }
  return fallbackStartPos
}

/**
 * Finds the STACK-ATTACH parent for a heading being inserted.
 *
 * STACK-ATTACH §5.2: Walk up the heading stack until you find an ancestor
 * with a STRICTLY LOWER level. The incoming heading becomes that ancestor's
 * last child (shouldNested = true, insert at endBlockPos - 2).
 *
 * When no parent exists in the map (stack empties), the fallback depends on
 * the relationship between headingLevel and the map entries:
 *
 *   - headingLevel < min(map) — heading is structurally ABOVE the scope
 *     (E-2 fix): return the FIRST block so the heading goes before existing
 *     entries, giving the hierarchy validation plugin the correct ordering.
 *
 *   - headingLevel >= min(map) — same-level sibling or H1 root insertion:
 *     return the last same-level block (or last block overall) for sibling
 *     placement after it.
 */
export const findPrevBlock = (
  mapHPost: HeadingBlockInfo[],
  headingLevel: number
): PrevBlockResult => {
  if (mapHPost.length === 0) {
    logger.error('[Heading][findPrevBlock] empty heading map')
    return { prevBlock: null, shouldNested: false }
  }

  const parent = mapHPost.findLast((x) => x.le < headingLevel)
  if (parent) {
    return { prevBlock: parent, shouldNested: true }
  }

  // No parent in scope — determine the best fallback.

  // E-2: Heading level is ABOVE everything in the map (e.g., H2 into [H3,H3,H3]).
  // Return the FIRST block so the heading is placed before higher-level entries.
  // This gives the hierarchy validation plugin correct ordering for restructuring.
  // Exclude H1 — callers handle root-level insertion independently.
  if (headingLevel > 1) {
    const minLevel = Math.min(...mapHPost.map((x) => x.le))
    if (headingLevel < minLevel) {
      return { prevBlock: mapHPost[0], shouldNested: false }
    }
  }

  // Same-level or deeper: sibling placement after the last matching block.
  const sameLevelSibling = mapHPost.findLast((x) => x.le === headingLevel)
  return {
    prevBlock: sameLevelSibling ?? mapHPost[mapHPost.length - 1],
    shouldNested: false
  }
}

/**
 * Computes the document insertion position from a findPrevBlock result.
 *
 * Centralizes the endBlockPos - (shouldNested ? 2 : 0) pattern that all
 * callers previously computed manually (DRY).
 *
 *   - shouldNested: true  → endBlockPos - 2 (inside parent's contentWrapper)
 *   - shouldNested: false → endBlockPos     (after the block as sibling)
 */
export const getInsertionPos = ({ prevBlock, shouldNested }: PrevBlockResult): number | null => {
  if (!prevBlock) return null
  return prevBlock.endBlockPos - (shouldNested ? 2 : 0)
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
  prevHStartPos,
  traversalMetrics
}: InsertHeadingsParams): boolean => {
  if (!headings.length) {
    logger.info('[Heading][insertRemainingHeadings] no headings to insert')
    return true
  }

  let mapHPost = getHeadingsBlocksMap(tr.doc, titleStartPos, titleEndPos)
  let scopedRangeStartPos = mapHPost.at(0)?.startBlockPos ?? titleStartPos
  let sectionStartPos = prevHStartPos > 0 ? prevHStartPos : titleStartPos

  // if the first heading is not h1, then we need to filter the mapHPost to only include headings that are before the current selection
  const firstHeading = headings.at(0)
  if (mapHPost.length > 1 && firstHeading && getHeadingLevel(firstHeading) !== 1) {
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
    )
  }

  for (const heading of headings) {
    const comingLevel = getHeadingLevel(heading)
    const firstHeadingInRange = mapHPost.at(0)
    if (!firstHeadingInRange) {
      break
    }

    const mappedEndPos = tr.mapping.map(firstHeadingInRange.endBlockPos)
    const rangeEndPos =
      mapHPost.length === 1 && firstHeadingInRange.le === 1
        ? firstHeadingInRange.endBlockPos
        : Math.max(mappedEndPos, firstHeadingInRange.endBlockPos)

    mapHPost = getPrevHeadingList(
      tr,
      scopedRangeStartPos,
      rangeEndPos,
      sectionStartPos,
      traversalMetrics
    )

    if (!mapHPost.length) {
      break
    }

    sectionStartPos = getLatestTopLevelStartPos(mapHPost, sectionStartPos)
    mapHPost = mapHPost.filter((x) => x.startBlockPos >= sectionStartPos)
    scopedRangeStartPos = mapHPost.at(0)?.startBlockPos ?? sectionStartPos

    const result = findPrevBlock(mapHPost, comingLevel)
    const headingInsertPos = getInsertionPos(result)
    if (headingInsertPos === null) {
      continue
    }

    const node = state.schema.nodeFromJSON(toHeadingJson(heading))

    tr.insert(headingInsertPos, node)

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
 * Inserts heading nodes into the document at their appropriate positions.
 *
 * Scans the current H1 section's heading map per iteration. The scan range
 * is bounded by the section size (not the full document), keeping cost at
 * O(n × s) where n = pasted headings, s = section heading count.
 *
 * Performance guard: headingMap.performance.test.js validates that 100
 * headings paste within budget.
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
  let currentH1 = { ...lastH1Inserted }

  headings.forEach((heading) => {
    const comingLevel = heading.attrs.level ?? heading.content.firstChild?.attrs?.level ?? 1
    let nodeAtStart: ReturnType<typeof tr.doc.nodeAt> = null
    try {
      nodeAtStart = tr.doc.nodeAt(currentH1.startBlockPos)
    } catch {
      // Position outside document fragment
    }
    if (!nodeAtStart) {
      logger.warn('[insertHeadingsByNodeBlocks] No node at startBlockPos, skipping heading')
      return
    }
    const endBlock =
      currentH1.endBlockPos === 0
        ? tr.mapping.map(from)
        : nodeAtStart.content.size + currentH1.startBlockPos

    const mapHPost = getHeadingsBlocksMap(tr.doc, currentH1.startBlockPos, endBlock).filter(
      (x) => x.startBlockPos >= (comingLevel === 1 ? titleStartPos : prevHStartPos)
    )

    const result = findPrevBlock(mapHPost, comingLevel)
    let { prevBlock } = result

    const sameLevelBlocks = mapHPost.filter((x) => prevBlock?.le === x?.le)
    if (sameLevelBlocks.length > 1) prevBlock = sameLevelBlocks.at(-1)!
    lastBlockPos = prevBlock?.endBlockPos || lastBlockPos

    const minDepthInScope =
      mapHPost.length > 0 ? Math.min(...mapHPost.map((h) => h.depth)) : Infinity
    if (prevBlock && prevBlock.depth === minDepthInScope) {
      prevHStartPos = prevBlock.startBlockPos
    }

    const insertPos = lastBlockPos - (result.shouldNested ? 2 : 0)
    tr.insert(insertPos, heading)

    if (comingLevel === 1) {
      currentH1 = {
        startBlockPos: lastBlockPos,
        endBlockPos: tr.mapping.map(lastBlockPos + heading.content.size)
      }
    }
  })

  lastH1Inserted.startBlockPos = currentH1.startBlockPos
  lastH1Inserted.endBlockPos = currentH1.endBlockPos

  return { lastBlockPos, prevHStartPos }
}
