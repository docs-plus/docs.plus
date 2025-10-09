import { TIPTAP_NODES } from '@types'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  createThisBlockMap,
  getHeadingsBlocksMap,
  getRangeBlocks,
  findPrevBlock,
  insertRemainingHeadings,
  createHeadingNodeFromSelection,
  putTextSelectionEndNode
} from './helper'
import { CommandArgs, HeadingAttributes } from './types'

const changeHeadingLevelH1 = (arrg: CommandArgs, attributes: HeadingAttributes): boolean => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, from } = selection
  const { start } = $from.blockRange($to)!

  console.info('[Heading]: change heading Level h1')

  if (start === 1 && $from.pos - $from.parentOffset === 2) {
    console.info('[Heading]: The first heading cannot be changed to a lower heading level')
    return true
  }

  const comingLevel = attributes.level
  const block = createThisBlockMap(state)
  const currentHLevel = $from.doc.nodeAt(block.start)!.attrs.level

  let titleStartPos = $from.start(1) - 1
  let titleEndPos = $to.end(1)

  let prevHStartPos = 0
  let prevHEndPos = 0

  const contentWrapper = getRangeBlocks(doc, titleStartPos + 1, titleEndPos)

  // TODO: handel this case later
  if ($from.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE && $from.pos !== $to.pos) {
    console.error(
      '[Heading]: Cannot change heading level when content is selected within a heading'
    )
    return false
  }

  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  doc.nodesBetween($from.start(0), start - 1, function (node: ProseMirrorNode, pos: number) {
    if (pos > start - 1) return

    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  const titleHMap = getHeadingsBlocksMap(doc, prevHStartPos, titleEndPos)
  let mapHPost = titleHMap.filter(
    (x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos
  )
  let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

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
  const insertPos = tr.mapping.map(prevBlock!.endBlockPos - (shouldNested ? 2 : 0))

  tr.insert(insertPos, newHeadingNode)

  // set the cursor to the end of the heading
  const updatedSelection = putTextSelectionEndNode(tr, insertPos, newHeadingNode)
  tr.setSelection(updatedSelection)

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
