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

const changeHeadingLevelBackward = (
  args: CommandArgs,
  attributes: HeadingAttributes,
  asWrapper: boolean = false
): boolean => {
  const { state, tr } = args
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  logger.info('[Heading]: Backward process, comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const titleStartPos = $from.start(1) - 1
  const sectionEndPos = $from.end(1)

  let headingEndPos = sectionEndPos
  for (let d = $from.depth; d >= 1; d--) {
    if ($from.node(d).type.name === TIPTAP_NODES.HEADING_TYPE) {
      headingEndPos = $from.after(d)
      break
    }
  }

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, headingEndPos)

  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  if (asWrapper && contentWrapperParagraphs.length === 0) {
    contentWrapperParagraphs.push({
      depth: 0,
      startBlockPos: 0,
      endBlockPos: 0,
      type: block.empty.type
    })
  }

  const node = createHeadingNodeFromSelection(
    doc,
    state,
    $from.pos,
    $to.pos,
    attributes,
    block,
    contentWrapperParagraphs
  )

  tr.delete(start - 1, headingEndPos)

  const titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(sectionEndPos))

  const { prevHStartPos } = getPrevHeadingPos(tr.doc, start - 1, tr.mapping.map(sectionEndPos))

  const mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos
  )

  const result = findPrevBlock(mapHPost, comingLevel)
  const insertPos =
    comingLevel === 1
      ? titleHMap.at(0)!.endBlockPos
      : (getInsertionPos(result) ?? titleHMap.at(0)!.endBlockPos)

  tr.insert(insertPos, node)

  const updatedSelection = putTextSelectionEndNode(tr, insertPos, node)
  tr.setSelection(updatedSelection)

  const lastH1Inserted = {
    startBlockPos: Math.min(tr.mapping.map(titleStartPos), tr.doc.content.size),
    endBlockPos: Math.min(tr.mapping.map(sectionEndPos), tr.doc.content.size)
  }

  if (comingLevel === 1) {
    lastH1Inserted.startBlockPos = insertPos
    lastH1Inserted.endBlockPos =
      tr.doc.nodeAt(lastH1Inserted.startBlockPos)!.content.size + lastH1Inserted.startBlockPos
  }

  insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos: comingLevel === 1 ? lastH1Inserted.startBlockPos : titleStartPos,
    titleEndPos: comingLevel === 1 ? lastH1Inserted.endBlockPos : tr.mapping.map(sectionEndPos),
    prevHStartPos:
      comingLevel === 1 ? lastH1Inserted.startBlockPos : titleHMap.at(-1)!.startBlockPos
  })

  return true
}

export default changeHeadingLevelBackward
