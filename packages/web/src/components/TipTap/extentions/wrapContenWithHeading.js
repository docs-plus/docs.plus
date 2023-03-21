import { TextSelection } from 'prosemirror-state'

import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import {
  getPrevHeadingList,
  createThisBlockMap,
  getHeadingsBlocksMap,
  getRangeBlocks
} from './helper'

export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, to } = selection
  const { start, end, depth } = $from.blockRange($to)

  const cominglevel = attributes.level
  const caretSelectionTextBlock = { type: 'text', text: doc?.nodeAt($anchor.pos)?.text || $anchor.nodeBefore?.text || ' ' }
  const block = createThisBlockMap($from, depth, caretSelectionTextBlock)

  // TODO: check this statment for comment, (block.edge.start !== -1)
  const parentLevel = block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level

  // Create a new heading with the same level
  // in this case all content below must cut and wrapp with the new heading
  // And the depth should be the same as the sibling Heading
  if (cominglevel === parentLevel) {
    console.info('[Heading]: create a new heading with same level')
    const contents = getRangeBlocks(doc, end, block.parent.end)
    const contentWrapper = contents.length === 0 ? [block.paragraph] : contents

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
          content: contentWrapper
        }
      ]
    }

    const headingNode = state.schema.nodeFromJSON(jsonNode)
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

    const titleHMap = getHeadingsBlocksMap(doc, block.start, block.parent.end)
    const contentWrapper = getRangeBlocks(doc, end, block.parent.end)
    const contentWrapperParagraphs = contentWrapper.filter(x => x.type !== 'heading')
    const contentWrapperHeadings = contentWrapper.filter(x => x.type === 'heading')

    const jsonNode = {
      type: 'heading',
      content: [
        {
          type: 'contentHeading',
          content: [block.headingContent],
          attrs: {
            level: cominglevel
          }
        },
        {
          type: 'contentWrapper',
          content: contentWrapperParagraphs
        }
      ]
    }
    const newHeadingNode = state.schema.nodeFromJSON(jsonNode)

    tr.delete(start + 1, block.parent.end)
    tr.insert(tr.mapping.map(start + 1), newHeadingNode)

    const newSelection = new TextSelection(tr.doc.resolve(start + 1))

    tr.setSelection(newSelection)

    let mapHPost = titleHMap

    for (const heading of contentWrapperHeadings) {
      const cominglevel = heading.le

      mapHPost = getPrevHeadingList(
        tr,
        mapHPost.at(0).startBlockPos,
        tr.mapping.map(mapHPost.at(0).endBlockPos)
      )

      mapHPost = mapHPost.filter(x =>
        x.startBlockPos < heading.startBlockPos &&
        x.startBlockPos >= block.parent.start
      )

      const prevBlockEqual = mapHPost.findLast(x => x.le === cominglevel)
      const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= cominglevel)
      const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= cominglevel)
      const lastBlock = mapHPost.at(-1)

      let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

      if (lastBlock.le <= cominglevel) prevBlock = lastBlock

      const shouldNested = prevBlock.le < cominglevel

      const node = state.schema.nodeFromJSON(heading)

      tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
    }

    return true
  }

  if (cominglevel < parentLevel) {
    console.info('[Heading]: break the current Heading chain, cominglevel is grether than parentLevel')

    return changeHeadingLevelBackward(arrg, attributes, true)
  }
}
