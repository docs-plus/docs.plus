import { Selection, TextSelection } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import {
  createHeadingNodeFromSelection,
  createThisBlockMap,
  findPrevBlock,
  getEndPosSelection,
  getHeadingsBlocksMap,
  getInsertionPos,
  getPrevHeadingPos,
  getRangeBlocks,
  insertRemainingHeadings,
  putTextSelectionEndNode
} from './helper'
import { CommandArgs, HeadingAttributes, SelectionBlock } from './types'

const wrapContentWithHeading = (
  arrg: CommandArgs,
  attributes: HeadingAttributes,
  newSelection: Selection | null = null
): boolean => {
  logger.info('[Heading]: Wrap up Content With Heading')
  const { state, tr } = arrg
  const { selection, doc } = state
  const targetSelection = newSelection || selection
  const { $from, $to } = targetSelection
  const selectionBlockRange = $from.blockRange($to)
  if (!selectionBlockRange) return false
  const { start, end } = selectionBlockRange

  const cominglevel = attributes.level
  const block = createThisBlockMap(state)

  // TODO: check this statment for comment, (block.edge.start !== -1)
  const edgeNode = block.edge.start !== -1 ? doc?.nodeAt(block.edge.start) : null
  const edgeNodeFirstChildLevel =
    edgeNode && edgeNode.childCount > 0 ? edgeNode.child(0)?.attrs?.level : undefined
  const parentLevel = edgeNodeFirstChildLevel || doc?.nodeAt(block.start)?.attrs.level

  let newStartPos = start

  const fromParent = $from.parent.type.name
  if (fromParent === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    const headSelection = $from.blockRange($to)
    if (!headSelection) return false
    // const headingLevel = headSelection.parent.attrs.level

    if (headSelection.parent.type.name === TIPTAP_NODES.HEADING_TYPE) {
      // INFO: 2 is the offset of the heading node
      newStartPos = headSelection.$from.pos - headSelection.$from.parentOffset - 2
    }
  }

  // Create a new heading with the same level
  // in this case all content below must cut and wrapp with the new heading
  // And the depth should be the same as the sibling Heading
  if (cominglevel === parentLevel) {
    logger.info('[Heading]: create a new heading with same level')

    let titleEndPos = $to.end(1)
    let titleStartPos = $from.start(1) - 1

    const startPos = getEndPosSelection(doc, state)
    const contents = getRangeBlocks(doc, startPos, titleEndPos)

    let paragraphs = contents.filter((x) => x.type === TIPTAP_NODES.PARAGRAPH_TYPE)
    const headings = contents.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

    paragraphs =
      paragraphs.length === 0
        ? ([block.paragraph] as SelectionBlock[])
        : (paragraphs as SelectionBlock[])

    if (doc?.nodeAt(start)?.type?.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
      logger.error(
        '[Heading][wrapContentWithHeading]: Cannot wrap content - content wrapper already exists at this position'
      )
      return false
    }

    const headingNode = createHeadingNodeFromSelection(
      doc,
      state,
      $from.pos,
      $to.pos,
      attributes,
      block,
      paragraphs
    )

    tr.delete(start + 1, titleEndPos)

    let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))
    const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, start)
    let mapHPost = titleHMap.filter(
      (x) => x.startBlockPos < start && x.startBlockPos >= prevHStartPos
    )
    const result = findPrevBlock(mapHPost, cominglevel)
    const insertFirstNodes = getInsertionPos(result)
    if (insertFirstNodes === null) return false
    tr.insert(insertFirstNodes, headingNode)

    const targetPos = Math.min(
      insertFirstNodes + headingNode[0].firstChild!.nodeSize,
      tr.doc.content.size - 1
    )

    const updatedSelection = new TextSelection(tr.doc.resolve(targetPos))
    tr.setSelection(updatedSelection)

    return insertRemainingHeadings({
      state,
      tr,
      headings,
      prevHStartPos,
      titleEndPos: tr.mapping.map(titleEndPos),
      titleStartPos
    })
  }

  // Create a new Heading block as a child of the current Heading block
  if (cominglevel > parentLevel) {
    logger.info('[Heading]: Create a new Heading block as a child of the current Heading block')

    const startPos = getEndPosSelection(doc, state)
    const rangeBlocks = getRangeBlocks(doc, $from.pos, end)
    const hasLevelOneHeading = rangeBlocks.some(
      (block) => block.type === TIPTAP_NODES.HEADING_TYPE && block.le === 1
    )

    if (hasLevelOneHeading) {
      logger.error(
        '[Heading]: Cannot wrap content with heading when there is a level 1 heading in the range'
      )
      return false
    }

    let titleStartPos = $from.start(1) - 1
    let titleEndPos = $to.end(1)

    const contentWrapper = getRangeBlocks(doc, startPos, titleEndPos)
    const contentWrapperParagraphs = contentWrapper.filter(
      (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
    )
    const contentWrapperHeadings = contentWrapper.filter(
      (x) => x.type === TIPTAP_NODES.HEADING_TYPE
    )

    const newHeadingNode = createHeadingNodeFromSelection(
      doc,
      state,
      newStartPos,
      $to.pos,
      attributes,
      block,
      contentWrapperParagraphs
    )

    const insertFirstNodesPos = tr.mapping.map(newStartPos)

    tr.delete(insertFirstNodesPos, $to.end(1))
    tr.insert(insertFirstNodesPos, newHeadingNode)

    const updatedSelection = putTextSelectionEndNode(tr, insertFirstNodesPos, newHeadingNode)
    tr.setSelection(updatedSelection)

    titleStartPos = newSelection ? $from.start(1) : $from.start(1) - 1
    titleEndPos = newSelection ? tr.selection.$to.end(1) : tr.mapping.map($to.end(1))

    try {
      insertRemainingHeadings({
        state,
        tr,
        headings: contentWrapperHeadings,
        prevHStartPos: $from.start(1) - 1,
        titleEndPos,
        titleStartPos
      })
      return true
    } catch (error) {
      logger.error('[Heading][wrapContentWithHeading]: error insertRemainingHeadings', error)
      return false
    }
  }

  if (cominglevel < parentLevel) {
    logger.info(
      '[Heading]: break the current Heading chain, cominglevel is grether than parentLevel'
    )

    return changeHeadingLevelBackward(arrg, attributes, true)
  }

  return false
}

export default wrapContentWithHeading
