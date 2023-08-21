import { TextSelection } from '@tiptap/pm/state'

import {
  getRangeBlocks,
  getHeadingsBlocksMap,
  createThisBlockMap,
  getPrevHeadingPos,
  findPrevBlock,
  insertRemainingHeadings
} from './helper'

const HEADING_OFFSET = 1

const changeHeadingLevelForward = (arrg, attributes) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, $anchor, from } = selection
  const { start, depth } = $from.blockRange($to)

  console.info('[Heading]: change heading level forwarding')

  const commingLevel = attributes.level
  const caretSelectionTextBlock = {
    type: 'text',
    text:
      doc.textBetween($from.pos, $to.pos, ' ') ||
      doc?.nodeAt($anchor.pos)?.text ||
      $anchor.nodeBefore?.text ||
      ' '
  }

  const block = createThisBlockMap($from, depth, caretSelectionTextBlock)

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)
  let titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === 'heading')

  const { prevHStartPos } = getPrevHeadingPos(doc, titleStartPos, start - 1)

  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)

  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

  if (prevBlock.le === 1) shouldNested = false

  const jsonNode = {
    type: 'heading',
    content: [
      {
        type: 'contentHeading',
        content: [block.headingContent],
        attrs: {
          level: attributes.level
        }
      },
      {
        type: 'contentWrapper',
        content: contentWrapperParagraphs
      }
    ]
  }

  const node = state.schema.nodeFromJSON(jsonNode)

  const nodeAtInsertPos = doc.nodeAt(start - HEADING_OFFSET)?.nodeSize

  // remove content from the current positon to the end of the heading
  tr.delete(start - HEADING_OFFSET + (nodeAtInsertPos === 2 ? HEADING_OFFSET : 0), titleEndPos)

  // if the node at insert position is empty block, increase the insert position on step
  tr.insert(tr.mapping.map(prevBlock.endBlockPos) - HEADING_OFFSET - (shouldNested ? 2 : 0), node)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(from - (shouldNested ? 2 : 0)))

  tr.setSelection(newSelection)

  // after all that, we need to loop through the rest of remaing heading to append
  return insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos,
    titleEndPos,
    prevHStartPos
  })
}

export default changeHeadingLevelForward
