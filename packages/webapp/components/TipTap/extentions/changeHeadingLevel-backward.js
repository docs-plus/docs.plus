import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getRangeBlocks,
  getHeadingsBlocksMap,
  createThisBlockMap,
  createHeadingNodeFromSelection,
  findPrevBlock,
  insertRemainingHeadings,
  getPrevHeadingPos
} from './helper'

const changeHeadingLevelBackward = (arrg, attributes, asWrapper = false) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, from } = selection
  const { start, end } = $from.blockRange($to)

  console.info('[Heading]: Backward process, comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $from.end(1)

  const contentWrapper = getRangeBlocks(doc, end, titleEndPos)

  const sliceTargetContent = contentWrapper.filter((x) => {
    if (x.type !== ENUMS.NODES.HEADING_TYPE) return x
  })

  if (asWrapper && sliceTargetContent.length === 0) {
    sliceTargetContent.push(block.empty)
  }

  const node = createHeadingNodeFromSelection(
    doc,
    state,
    $from.pos,
    $to.pos,
    attributes,
    block,
    sliceTargetContent,
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

  const newTextSelection = new TextSelection(tr.doc.resolve(insertPos))
  tr.setSelection(newTextSelection)

  const lastH1Inserted = {
    startBlockPos: 0,
    endBlockPos: 0
  }

  let totalNodeSize = 0
  node.forEach((nodeItem) => {
    totalNodeSize += nodeItem.nodeSize
  })

  if (comingLevel === 1) {
    lastH1Inserted.startBlockPos = insertPos
    lastH1Inserted.endBlockPos = insertPos + totalNodeSize
    // also update the state
    // Update the selection to the end of the newly inserted H1
    const newPos = insertPos
    const newSelection = TextSelection.create(tr.doc, newPos)
    tr.setSelection(newSelection)
  }

  insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE), //newContentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE),
    titleStartPos: comingLevel === 1 ? lastH1Inserted.startBlockPos : titleStartPos,
    titleEndPos: comingLevel === 1 ? lastH1Inserted.endBlockPos : tr.mapping.map(titleEndPos),
    prevHStartPos: comingLevel === 1 ? lastH1Inserted.startBlockPos : titleHMap.at(-1).startBlockPos
  })

  return true
}

export default changeHeadingLevelBackward
