import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getRangeBlocks,
  getHeadingsBlocksMap,
  createThisBlockMap,
  createHeadingNodeFromSelection
} from './helper'

const changeHeadingLevelBackward = (arrg, attributes, asWrapper = false) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, from } = selection
  const { start, end } = $from.blockRange($to)

  console.info('[Heading]: Backward process,  comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = getRangeBlocks(doc, end, titleEndPos)
  const titleHMap = getHeadingsBlocksMap(doc, start, titleEndPos)

  const sliceTargetContent = contentWrapper.filter((x) => {
    if (x.type !== ENUMS.NODES.HEADING_TYPE) return x

    return x.le > comingLevel
  })

  // remove the first paragraph, if the request is to wrap the content
  if (asWrapper && sliceTargetContent.length === 0) {
    sliceTargetContent.push(block.empty)
  }

  const lastBlockPos = sliceTargetContent[sliceTargetContent.length - 1]?.endBlockPos
  const insertPos = lastBlockPos
    ? titleHMap.filter((x) => lastBlockPos <= x.endBlockPos).find((x) => x.le >= comingLevel)
        ?.endBlockPos
    : titleHMap.find((x) => x.le >= comingLevel)?.endBlockPos

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

  const newTr = tr.insert(insertPos, node)

  const newTextSelection = new TextSelection(newTr.doc.resolve(from))

  newTr.setSelection(newTextSelection)
  newTr.deleteRange(start - 1, insertPos)

  return true
}

export default changeHeadingLevelBackward
