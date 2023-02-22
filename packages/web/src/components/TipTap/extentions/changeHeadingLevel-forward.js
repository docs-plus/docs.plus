import { TextSelection } from 'prosemirror-state'

import { getRangeBlocks, getHeadingsBlocksMap, createThisBlockMap, getPrevHeadingList } from './helper'

export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, $head, from } = selection
  const { start, end, depth } = $from.blockRange($to)

  console.log('[Heading]: change heading level forwarding')

  const commingLevel = attributes.level
  const caretSelectionTextBlock = { type: 'text', text: doc?.nodeAt($anchor.pos)?.text || $anchor.nodeBefore?.text || ' ' }

  const block = createThisBlockMap($from, depth, caretSelectionTextBlock)
  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)
  const titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)

  const contentWrapperParagraphs = contentWrapper.filter(x => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter(x => x.type === 'heading')

  let prevHStartPos = 0
  let prevHEndPos = 0

  doc.nodesBetween(titleStartPos, start - 1, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
      const depth = doc.resolve(pos).depth

      // INFO: this the trick I've looking for
      if (depth === 2) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  let mapHPost = titleHMap.filter(x =>
    x.startBlockPos < start - 1 &&
    x.startBlockPos >= prevHStartPos
  )

  let shouldNested = false

  // let prevBlock = mapHPost.find(x => x.le >= commingLevel)
  // FIXME: this is heavy! I need to find better solotion with less loop
  const prevBlockEqual = mapHPost.findLast(x => x.le === commingLevel)
  const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= commingLevel)
  const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= commingLevel)
  const lastBlock = mapHPost.at(-1)
  let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

  if (lastBlock?.le <= commingLevel) prevBlock = lastBlock
  if (!prevBlock) prevBlock = lastBlock
  shouldNested = prevBlock.le < commingLevel

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

  // remove content from the current positon to the end of the heading
  tr.delete(start - 1, titleEndPos)
  // then add the new heading with the content
  const insertPos = (contentWrapperHeadings.length === 0 ? prevBlock.endBlockPos : start - 1) - (shouldNested ? 2 : 0)

  tr.insert(tr.mapping.map(insertPos), node)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(newSelection)

  // after all that, we need to loop through the heading to append
  for (const heading of contentWrapperHeadings) {
    const commingLevel = heading.le

    mapHPost = getPrevHeadingList(
      tr,
      mapHPost.at(0).startBlockPos,
      tr.mapping.map(mapHPost.at(0).endBlockPos)
    )

    mapHPost = mapHPost.filter(x =>
      x.startBlockPos < heading.startBlockPos &&
      x.startBlockPos >= prevHStartPos
    )

    const prevBlockEqual = mapHPost.findLast(x => x.le === commingLevel)
    const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= commingLevel)
    const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= commingLevel)
    const lastBlock = mapHPost.at(-1)

    prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
    if (lastBlock.le <= commingLevel) prevBlock = lastBlock
    shouldNested = prevBlock.le < commingLevel

    const node = state.schema.nodeFromJSON(heading)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  return true
}
