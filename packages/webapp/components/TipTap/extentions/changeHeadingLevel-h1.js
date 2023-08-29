import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  createThisBlockMap,
  getHeadingsBlocksMap,
  getRangeBlocks,
  getPrevHeadingPos,
  insertRemainingHeadings
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

  let titleStartPos = 0
  let titleEndPos = 0

  doc.nodesBetween($from.start(0), start - 1, function (node, pos) {
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        titleStartPos = pos
        // INFO: I need the pos of last content in contentWrapper
        titleEndPos = pos + node.content.size
      }
    }
  })

  const contentWrapper = getRangeBlocks(
    doc,
    start,
    $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size
  )
  const titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

  const { prevHStartPos } = getPrevHeadingPos(doc, titleStartPos, start - 1)

  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)

  let shouldNested = false

  // FIXME: this is heavy! I need to find better solotion with less loop
  const prevBlockEqual = mapHPost.findLast((x) => x.le === commingLevel)
  const prevBlockGratherFromFirst = mapHPost.find((x) => x.le >= commingLevel)
  const prevBlockGratherFromLast = mapHPost.findLast((x) => x.le <= commingLevel)
  const lastbloc = mapHPost.at(-1)
  let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

  if (lastbloc.le <= commingLevel) prevBlock = lastbloc
  shouldNested = prevBlock.le < commingLevel

  const jsonNode = {
    type: ENUMS.NODES.HEADING_TYPE,
    attrs: {
      level: attributes.level
    },
    content: [
      {
        type: ENUMS.NODES.HEADING_CONTENT_TYPE,
        content: [block.headingContent],
        attrs: {
          level: attributes.level
        }
      },
      {
        type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
        content: contentWrapperParagraphs
      }
    ]
  }
  const node = state.schema.nodeFromJSON(jsonNode)

  // remove content from the current positon to the end of the heading
  tr.delete(start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  // then add the new heading with the content
  const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(tr.mapping.map(insertPos), node)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(newSelection)

  // FIXME: this loop so much heavy, I need to find better solotion!
  // then loop through the heading to append

  return insertRemainingHeadings({
    state,
    tr,
    headings: contentWrapperHeadings,
    titleStartPos,
    titleEndPos,
    prevHStartPos
  })
}

export default changeHeadingLevelH1
