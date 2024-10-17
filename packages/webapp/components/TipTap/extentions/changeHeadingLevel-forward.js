import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getRangeBlocks,
  getHeadingsBlocksMap,
  createThisBlockMap,
  getPrevHeadingPos,
  findPrevBlock,
  insertRemainingHeadings,
  createHeadingNodeFromSelection,
  getEndPosSelection
} from './helper'

const changeHeadingLevelForward = (arrg, attributes) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)

  console.info('[Heading]: change heading level forwarding')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  let newStartPos = start

  const fromParent = $from.parent.type.name
  if (fromParent === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    const headSelection = $from.blockRange($to)
    if (headSelection.parent.type.name === ENUMS.NODES.HEADING_TYPE) {
      // INFO: 2 is the offset of the heading node
      newStartPos = headSelection.$from.pos - headSelection.$from.parentOffset - 2
    }
  }

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

  const newHeadingNode = createHeadingNodeFromSelection(
    doc,
    state,
    newStartPos,
    $to.pos,
    attributes,
    block,
    contentWrapperParagraphs,
    selection
  )

  tr.delete(newStartPos, titleEndPos)

  let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))
  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, newStartPos)
  let mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < newStartPos && x.startBlockPos >= prevHStartPos
  )
  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

  tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), newHeadingNode)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(newStartPos - (shouldNested ? 2 : 0)))

  tr.setSelection(newSelection)

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
