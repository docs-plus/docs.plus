import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  createThisBlockMap,
  getHeadingsBlocksMap,
  getRangeBlocks,
  findPrevBlock,
  insertRemainingHeadings,
  createHeadingNodeFromSelection
} from './helper'

const changeHeadingLevelH1 = (arrg, attributes) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, from } = selection
  const { start } = $from.blockRange($to)

  console.info('[Heading]: change heading Level h1')

  const commingLevel = attributes.level
  const block = createThisBlockMap(state)
  const currentHLevel = $from.doc.nodeAt(block.start).attrs.level

  let titleStartPos = $from.start(1) - 1
  let titleEndPos = $to.end(1)

  let prevHStartPos = 0
  let prevHEndPos = 0

  const contentWrapper = getRangeBlocks(doc, titleStartPos + 1, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

  doc.nodesBetween($from.start(0), start - 1, function (node, pos) {
    if (pos > start - 1) return

    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  const titleHMap = getHeadingsBlocksMap(doc, prevHStartPos, titleEndPos)
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)
  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

  const newHeadingNode = createHeadingNodeFromSelection(
    doc,
    state,
    titleStartPos,
    titleStartPos,
    attributes,
    block,
    contentWrapperParagraphs
  )

  // remove content from the current positon to the end of the heading
  tr.delete(titleStartPos, titleEndPos)

  // then add the new heading with the content
  const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(tr.mapping.map(insertPos), newHeadingNode)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(newSelection)

  // then loop through the heading to append
  return insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos: prevHStartPos,
    titleEndPos: prevHEndPos,
    prevHStartPos
  })
}

export default changeHeadingLevelH1
