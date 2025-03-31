import ENUMS from '../enums'
import {
  getRangeBlocks,
  getHeadingsBlocksMap,
  createThisBlockMap,
  createHeadingNodeFromSelection,
  findPrevBlock,
  insertRemainingHeadings,
  getPrevHeadingPos,
  getEndPosSelection,
  putTextSelectionEndNode
} from './helper'

const changeHeadingLevelBackward = (arrg, attributes, asWrapper = false) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start, end } = $from.blockRange($to)

  console.info('[Heading]: Backward process, comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $from.end(1)

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

  if (asWrapper && contentWrapperParagraphs.length === 0) {
    contentWrapperParagraphs.push(block.empty)
  }

  const node = createHeadingNodeFromSelection(
    doc,
    state,
    $from.pos,
    $to.pos,
    attributes,
    block,
    contentWrapperParagraphs,
    selection
  )

  tr.delete(start - 1, titleEndPos)

  const titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))

  const { prevHStartPos } = getPrevHeadingPos(tr.doc, start - 1, tr.mapping.map(titleEndPos))

  const mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos
  )

  const { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)
  const insertPos =
    comingLevel === 1 ? titleHMap.at(0).endBlockPos : prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(insertPos, node)

  const updatedSelection = putTextSelectionEndNode(tr, insertPos, node)
  tr.setSelection(updatedSelection)

  const lastH1Inserted = {
    startBlockPos: Math.min(tr.mapping.map(titleStartPos), tr.doc.content.size),
    endBlockPos: Math.min(tr.mapping.map(titleEndPos), tr.doc.content.size)
  }

  let totalNodeSize = 0
  node.forEach((nodeItem) => {
    totalNodeSize += nodeItem.nodeSize
  })

  if (comingLevel === 1) {
    lastH1Inserted.startBlockPos = insertPos
    lastH1Inserted.endBlockPos =
      tr.doc.nodeAt(lastH1Inserted.startBlockPos).content.size + lastH1Inserted.startBlockPos
  }

  insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos: comingLevel === 1 ? lastH1Inserted.startBlockPos : titleStartPos,
    titleEndPos: comingLevel === 1 ? lastH1Inserted.endBlockPos : tr.mapping.map(titleEndPos),
    prevHStartPos: comingLevel === 1 ? lastH1Inserted.startBlockPos : titleHMap.at(-1).startBlockPos
  })

  return true
}

export default changeHeadingLevelBackward
