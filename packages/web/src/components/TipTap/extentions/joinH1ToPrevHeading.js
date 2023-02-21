import { TextSelection } from 'prosemirror-state'

import { getPrevHeadingList, createThisBlockMap, getHeadingsBlocksMap, getRangeBlocks } from './helper'

export default (arrg) => {
  const { can, chain, commands, dispatch, editor, state, view } = arrg
  const { schema, selection, doc, tr } = state
  const { $from, $to, $anchor, $cursor, from } = selection
  const { start, end, depth } = $from.blockRange($to)

  const block = createThisBlockMap($from, depth)
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

  let mapHPost = titleHMap

  let shouldNested = false

  const prevBlock = titleHMap.at(-1)

  const paragraphs = contentWrapperParagraphs.map(x => schema.nodeFromJSON(x))

  // remove content from the current positon to the end of the heading
  tr.delete(start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  // first create the current heading with new level
  tr.insert(prevBlock.endBlockPos - 2, paragraphs)

  const newTextSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(newTextSelection)

  // FIXME: this loop so much heavy, I need to find better solotion!
  // then loop through the heading to append
  for (const heading of contentWrapperHeadings) {
    mapHPost = getPrevHeadingList(
      tr,
      mapHPost.at(0).startBlockPos,
      mapHPost.at(0).startBlockPos + tr.doc.nodeAt(mapHPost.at(0).startBlockPos).nodeSize
    )

    mapHPost = mapHPost.filter(x =>
      x.startBlockPos < heading.startBlockPos &&
      x.startBlockPos >= prevHStartPos
    )

    const node = schema.nodeFromJSON(heading)

    const prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
    const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
    const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
    const lastbloc = mapHPost.at(-1)
    let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

    if (lastbloc.le <= heading.le) prevBlock = lastbloc
    shouldNested = prevBlock.le < heading.le

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  return view.dispatch(tr)
}
