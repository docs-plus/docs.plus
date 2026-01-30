import { Node as _ProseMirrorNode } from '@tiptap/pm/model'
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

const changeHeadingLevelBackward = (
  arrg: CommandArgs,
  attributes: HeadingAttributes,
  asWrapper: boolean = false
): boolean => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  console.info('[Heading]: Backward process, comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $from.end(1)

  const startPos = getEndPosSelection(doc, state)
  const contentWrapper = getRangeBlocks(doc, startPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  if (asWrapper && contentWrapperParagraphs.length === 0) {
    contentWrapperParagraphs.push(block.empty as any)
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

  tr.delete(start - 1, titleEndPos)

  const titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))

  const { prevHStartPos } = getPrevHeadingPos(tr.doc, start - 1, tr.mapping.map(titleEndPos))

  const mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos
  )

  const { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)
  const insertPos =
    comingLevel === 1
      ? titleHMap.at(0)!.endBlockPos
      : prevBlock!.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(insertPos, node)

  const updatedSelection = putTextSelectionEndNode(tr, insertPos, node)
  tr.setSelection(updatedSelection)

  const lastH1Inserted = {
    startBlockPos: Math.min(tr.mapping.map(titleStartPos), tr.doc.content.size),
    endBlockPos: Math.min(tr.mapping.map(titleEndPos), tr.doc.content.size)
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
    titleEndPos: comingLevel === 1 ? lastH1Inserted.endBlockPos : tr.mapping.map(titleEndPos),
    prevHStartPos:
      comingLevel === 1 ? lastH1Inserted.startBlockPos : titleHMap.at(-1)!.startBlockPos
  })

  return true
}

export default changeHeadingLevelBackward
