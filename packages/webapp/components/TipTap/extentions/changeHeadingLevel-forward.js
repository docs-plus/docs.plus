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
  const { $from, $to, from } = selection
  const { start } = $from.blockRange($to)

  console.info('[Heading]: change heading level forwarding')

  const commingLevel = attributes.level
  const block = createThisBlockMap(state)

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === 'heading')

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

  tr.delete(start - 1, titleEndPos)

  let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, titleEndPos)
  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, start - 1)
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)
  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

  tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)

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
    prevHStartPos: titleStartPos
  })
}

export default changeHeadingLevelForward
