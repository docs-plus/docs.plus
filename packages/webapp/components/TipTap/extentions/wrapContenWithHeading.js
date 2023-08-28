import { TextSelection } from '@tiptap/pm/state'

import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import {
  createThisBlockMap,
  createHeadingNodeFromSelection,
  getRangeBlocks,
  insertRemainingHeadings
} from './helper'

const wrapContentWithHeading = (arrg, attributes, newSelection = null) => {
  console.info('[Heading]: wrapContentWithHeading')
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

  // Create a new heading with the same level
  // in this case all content below must cut and wrapp with the new heading
  // And the depth should be the same as the sibling Heading
  if (cominglevel === parentLevel) {
    console.info('[Heading]: create a new heading with same level')
    const contents = getRangeBlocks(doc, end, block.parent.end)
    const contentWrapper = contents.length === 0 ? [block.paragraph] : contents

    const headingNode = createHeadingNodeFromSelection(
      doc,
      state,
      $from.pos,
      $to.pos,
      attributes,
      block,
      contentWrapper
    )

    const insertPos = start + 1

    tr.delete(insertPos, block.edge.end)
    tr.insert(tr.mapping.map(block.edge.end), headingNode)

    const newSelection = new TextSelection(tr.doc.resolve(insertPos))

    tr.setSelection(newSelection)

    return true
  }

  // Create a new Heading block as a child of the current Heading block
  if (cominglevel > parentLevel) {
    console.info('[Heading]: Create a new Heading block as a child of the current Heading block')

    const contentWrapper = getRangeBlocks(doc, end, block.parent.end)
    const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== 'heading')
    const contentWrapperHeadings = contentWrapper.filter((x) => x.type === 'heading')

    const newHeadingNode = createHeadingNodeFromSelection(
      doc,
      state,
      start,
      $to.pos,
      attributes,
      block,
      contentWrapperParagraphs
    )

    tr.delete(start, block.parent.end)
    tr.insert(tr.mapping.map(start), newHeadingNode)

    const newSelection = new TextSelection(tr.doc.resolve(end))
    tr.setSelection(newSelection)

    const titleStartPos = newSelection ? $from.start(1) : $from.start(1) - 1
    const titleEndPos = newSelection ? tr.curSelection.$to.end(1) : $to.end(1)

    return insertRemainingHeadings({
      state,
      tr,
      headings: contentWrapperHeadings,
      prevHStartPos: $from.start(1) - 1,
      titleEndPos,
      titleStartPos
    })
  }

  if (cominglevel < parentLevel) {
    console.info('[Heading]: break the current Heading chain, cominglevel is grether than parentLevel')

    return changeHeadingLevelBackward(arrg, attributes, true)
  }
}

export default wrapContentWithHeading
