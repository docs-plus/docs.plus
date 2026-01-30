import { TIPTAP_NODES } from '@types'

import {
  createHeadingNodeFromSelection,
  createThisBlockMap,
  findPrevBlock,
  getEndPosSelection,
  getHeadingsBlocksMap,
  getPrevHeadingPos,
  getRangeBlocks,
  insertRemainingHeadings,
  putTextSelectionEndNode
} from './helper'
import { CommandArgs, HeadingAttributes } from './types'

const changeHeadingLevelForward = (arrg: CommandArgs, attributes: HeadingAttributes): boolean => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  console.info('[Heading]: change heading level forwarding')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  let newStartPos = start

  const fromParent = $from.parent.type.name
  if (fromParent === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    const headSelection = $from.blockRange($to)!
    if (headSelection.parent.type.name === TIPTAP_NODES.HEADING_TYPE) {
      // INFO: 2 is the offset of the heading node
      newStartPos = headSelection.$from.pos - headSelection.$from.parentOffset - 2
    }
  }

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, titleEndPos)

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

  tr.delete(newStartPos, titleEndPos)

  let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))
  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, newStartPos)
  let mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < newStartPos && x.startBlockPos >= prevHStartPos
  )
  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

  const insertPos = prevBlock!.endBlockPos - (shouldNested ? 2 : 0)
  tr.insert(insertPos, newHeadingNode)

  // set the cursor to the end of the heading
  const updatedSelection = putTextSelectionEndNode(tr, insertPos, newHeadingNode)
  tr.setSelection(updatedSelection)

  // after all that, we need to loop through the rest of remaing heading to append
  return insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos,
    titleEndPos: tr.mapping.map(titleEndPos),
    prevHStartPos: titleStartPos
  })
}

export default changeHeadingLevelForward
