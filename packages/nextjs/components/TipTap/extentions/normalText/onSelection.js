import { TextSelection } from 'prosemirror-state'

import { getSelectionBlocks, getRangeBlocks, getPrevHeadingList } from '../helper'

export default (arrg) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, $head, from, to } = selection
  const { start, end, depth } = $from.blockRange($to)

  const currentHLevel = $from.parent.attrs.level
  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  let titleStartPos = $from.start(1) - 1
  let titleEndPos = titleStartPos + titleNode.content.size
  const prevHStartPos = 0
  const prevHEndPos = 0

  const selectionFirstLinePos = $from.pos - $from.parentOffset

  const selectedContents = getSelectionBlocks(doc, selectionFirstLinePos - 1, to)
  const lastHeadingInSelection = selectedContents.findLast(x => x.hasOwnProperty('attrs'))
  const lastHeadingIndex = selectedContents.findLastIndex(x => x.hasOwnProperty('attrs'))

  // on selection we have Heading level 1
  if (titleEndPos < to) {
    const getTitleBlock = selectedContents.findLast(x => x.level === 1)

    titleEndPos = (getTitleBlock.startBlockPos + doc.nodeAt(getTitleBlock.startBlockPos - 1).nodeSize) - 1
  }

  // select rest of contents
  const contentWrapper = getRangeBlocks(doc, lastHeadingInSelection.startBlockPos, titleEndPos)
  const contentWrapperParagraphs = contentWrapper.filter(x => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter(x => x.type === 'heading')

  const normalizeSelectedContents = [
    ...[...selectedContents].splice(0, lastHeadingIndex + 1),
    ...contentWrapperParagraphs
  ]

  doc.nodesBetween(titleStartPos, start - 1, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
      const headingLevel = node.firstChild?.attrs?.level

      if (headingLevel === currentHLevel) {
        titleStartPos = pos
        // INFO: I need the pos of last content in contentWrapper
        titleEndPos = pos + node.content.size
      }
    }
  })

  const normalizeSelectedContentsBlocks = normalizeSelectedContents.map(node => state.schema.nodeFromJSON(node))

  tr.delete(selectionFirstLinePos, titleEndPos)

  tr.insert(tr.mapping.map(selectionFirstLinePos) - 1, normalizeSelectedContentsBlocks)

  const focusSelection = new TextSelection(tr.doc.resolve(from))

  tr.setSelection(focusSelection)

  const titleHMap = getPrevHeadingList(tr, tr.mapping.map(titleStartPos), tr.mapping.map(titleEndPos))
  let shouldNested = false

  let mapHPost = titleHMap.filter(x =>
    x.startBlockPos < start - 1 &&
    x.startBlockPos >= prevHStartPos
  )

  if (!mapHPost.length) mapHPost = titleHMap

  for (const heading of contentWrapperHeadings) {
    const startBlock = mapHPost[0].startBlockPos
    const endBlock = tr.mapping.map(mapHPost.at(0).endBlockPos)

    mapHPost = getPrevHeadingList(tr, startBlock, endBlock)

    const node = state.schema.nodeFromJSON(heading)

    const prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
    const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
    const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
    const lastbloc = mapHPost[mapHPost.length - 1]
    let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

    if (lastbloc.le <= heading.le) prevBlock = lastbloc
    shouldNested = prevBlock.le < heading.le

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  return true
}
