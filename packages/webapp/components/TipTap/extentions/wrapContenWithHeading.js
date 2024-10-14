import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import {
  createThisBlockMap,
  createHeadingNodeFromSelection,
  getRangeBlocks,
  insertRemainingHeadings,
  getHeadingsBlocksMap,
  getPrevHeadingPos,
  findPrevBlock
} from './helper'

const wrapContentWithHeading = (arrg, attributes, newSelection = null) => {
  console.info('[Heading]: Wrap up Content With Heading')
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to } = newSelection || selection
  const { start, end } = $from.blockRange($to)

  const cominglevel = attributes.level
  const block = createThisBlockMap(state)

  // TODO: check this statment for comment, (block.edge.start !== -1)
  const parentLevel =
    (block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level) ||
    doc?.nodeAt(block.start).attrs.level

  let newStartPos = start

  const fromParent = $from.parent.type.name
  if (fromParent === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    const headSelection = $from.blockRange($to)
    const headingLevel = headSelection.parent.attrs.level

    if (headSelection.parent.type.name === ENUMS.NODES.HEADING_TYPE) {
      // INFO: 2 is the offset of the heading node
      newStartPos = headSelection.$from.pos - headSelection.$from.parentOffset - 2
    }
  }

  // Create a new heading with the same level
  // in this case all content below must cut and wrapp with the new heading
  // And the depth should be the same as the sibling Heading
  if (cominglevel === parentLevel) {
    console.info('[Heading]: create a new heading with same level')

    let titleEndPos = $to.end(1)
    let titleStartPos = $from.start(1) - 1
    const contents = getRangeBlocks(doc, end, titleEndPos)

    let paragraphs = contents.filter((x) => x.type === ENUMS.NODES.PARAGRAPH_TYPE)
    const headings = contents.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

    paragraphs = paragraphs.length === 0 ? [block.paragraph] : paragraphs

    if (doc?.nodeAt(start)?.type?.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
      console.error(
        '[Heading][wrapContentWithHeading]: Cannot wrap content - content wrapper already exists at this position'
      )
      return false
    }

    console.log('p[p[[p', {
      selection
    })
    const headingNode = createHeadingNodeFromSelection(
      doc,
      state,
      $from.pos,
      $to.pos,
      attributes,
      block,
      paragraphs,
      selection
    )

    console.log({
      headingNode
    })

    tr.delete(start, titleEndPos)

    let titleHMap = getHeadingsBlocksMap(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))
    const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, start)
    let mapHPost = titleHMap.filter(
      (x) => x.startBlockPos < start && x.startBlockPos >= prevHStartPos
    )
    let { prevBlock, shouldNested } = findPrevBlock(mapHPost, cominglevel)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), headingNode)

    return insertRemainingHeadings({
      state,
      tr,
      headings,
      prevHStartPos,
      titleEndPos: tr.mapping.map(titleEndPos),
      titleStartPos
    })
  }

  // Create a new Heading block as a child of the current Heading block
  if (cominglevel > parentLevel) {
    console.info('[Heading]: Create a new Heading block as a child of the current Heading block')

    const rangeBlocks = getRangeBlocks(doc, $from.pos, end)
    const hasLevelOneHeading = rangeBlocks.some(
      (block) => block.type === ENUMS.NODES.HEADING_TYPE && block.attrs.level === 1
    )

    if (hasLevelOneHeading) {
      console.error(
        '[Heading]: Cannot wrap content with heading when there is a level 1 heading in the range'
      )
      return false
    }

    let titleStartPos = $from.start(1) - 1
    let titleEndPos = $to.end(1)

    const contentWrapper = getRangeBlocks(doc, end, titleEndPos)
    const contentWrapperParagraphs = contentWrapper.filter(
      (x) => x.type !== ENUMS.NODES.HEADING_TYPE
    )
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

    tr.delete(tr.mapping.map(newStartPos), block.parent.end)
    tr.insert(tr.mapping.map(newStartPos), newHeadingNode)

    const newSelection = new TextSelection(tr.doc.resolve(end))
    tr.setSelection(newSelection)

    titleStartPos = newSelection ? $from.start(1) : $from.start(1) - 1
    titleEndPos = newSelection ? tr.curSelection.$to.end(1) : $to.end(1)

    try {
      insertRemainingHeadings({
        state,
        tr,
        headings: contentWrapperHeadings,
        prevHStartPos: $from.start(1) - 1,
        titleEndPos,
        titleStartPos
      })
      return true
    } catch (error) {
      console.error('[Heading][wrapContentWithHeading]: error insertRemainingHeadings')
      return false
    }
  }

  if (cominglevel < parentLevel) {
    console.info(
      '[Heading]: break the current Heading chain, cominglevel is grether than parentLevel'
    )

    return changeHeadingLevelBackward(arrg, attributes, true)
  }
}

export default wrapContentWithHeading
