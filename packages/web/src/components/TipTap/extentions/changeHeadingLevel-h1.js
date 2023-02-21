import { TextSelection } from 'prosemirror-state'

import { getPrevHeadingList, createThisBlockMap, getHeadingsBlocksMap, getRangeBlocks } from './helper'

export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, from } = selection
  const { start, end, depth } = $from.blockRange($to)

  console.log('[Heading]: change heading Level h1')

  const commingLevel = attributes.level
  const caretSelectionTextBlock = { type: 'text', text: doc?.nodeAt($anchor.pos)?.text || $anchor.nodeBefore?.text || ' ' }

  const block = createThisBlockMap($from, depth, caretSelectionTextBlock)
  const currentHLevel = $from.doc.nodeAt(block.start).attrs.level

  let titleStartPos = 0
  let titleEndPos = 0

  doc.nodesBetween($from.start(0), start - 1, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        titleStartPos = pos
        // INFO: I need the pos of last content in contentWrapper
        titleEndPos = pos + node.content.size
      }
    }
  })

  const contentWrapper = getRangeBlocks(doc, start, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)
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

  // FIXME: this is heavy! I need to find better solotion with less loop
  const prevBlockEqual = mapHPost.findLast(x => x.le === commingLevel)
  const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= commingLevel)
  const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= commingLevel)
  const lastbloc = mapHPost.at(-1)
  let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

  if (lastbloc.le <= commingLevel) prevBlock = lastbloc
  shouldNested = prevBlock.le < commingLevel

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
  tr.delete(start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  // then add the new heading with the content
  const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(tr.mapping.map(insertPos), node)

  // set the cursor to the end of the heading
  const newSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(newSelection)

  // FIXME: this loop so much heavy, I need to find better solotion!
  // then loop through the heading to append
  for (const heading of contentWrapperHeadings) {
    mapHPost = getPrevHeadingList(
      tr,
      mapHPost[0].startBlockPos,
      mapHPost[0].startBlockPos + doc.nodeAt(mapHPost[0].startBlockPos).nodeSize + 2
    )

    mapHPost = mapHPost.filter(x =>
      x.startBlockPos < heading.startBlockPos &&
      x.startBlockPos >= prevHStartPos
    )

    const node = state.schema.nodeFromJSON(heading)

    const prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
    const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
    const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
    const lastbloc = mapHPost.at(-1)
    let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

    if (lastbloc.le <= heading.le) prevBlock = lastbloc
    shouldNested = prevBlock.le < heading.le

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }
}
