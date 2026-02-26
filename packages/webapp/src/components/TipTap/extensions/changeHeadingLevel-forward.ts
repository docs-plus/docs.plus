import { TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

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
import { CommandArgs, HeadingAttributes } from './types'

const changeHeadingLevelForward = (args: CommandArgs, attributes: HeadingAttributes): boolean => {
  const { state, tr } = args
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  logger.info('[Heading]: change heading level forwarding')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)

  const titleStartPos = $from.start(1) - 1
  const sectionEndPos = $to.end(1)

  let newStartPos = start
  let headingEndPos = sectionEndPos

  const fromParent = $from.parent.type.name
  if (fromParent === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    const headSelection = $from.blockRange($to)!
    if (headSelection.parent.type.name === TIPTAP_NODES.HEADING_TYPE) {
      newStartPos = headSelection.$from.pos - headSelection.$from.parentOffset - 2
      headingEndPos = newStartPos + headSelection.parent.nodeSize
    }
  }

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, headingEndPos)

  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  const newHeadingNode = createHeadingNodeFromSelection(
    doc,
    state,
    newStartPos,
    $to.pos,
    attributes,
    block,
    contentWrapperParagraphs
  )

  tr.delete(newStartPos, headingEndPos)

  let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(sectionEndPos))
  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, newStartPos)
  let mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < newStartPos && x.startBlockPos >= prevHStartPos
  )
  const result = findPrevBlock(mapHPost, comingLevel)
  const insertPos = getInsertionPos(result)
  if (insertPos === null) return false
  tr.insert(insertPos, newHeadingNode)

  const updatedSelection = putTextSelectionEndNode(tr, insertPos, newHeadingNode)
  tr.setSelection(updatedSelection)

  return insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos,
    titleEndPos: tr.mapping.map(sectionEndPos),
    prevHStartPos: titleStartPos
  })
}

export default changeHeadingLevelForward
