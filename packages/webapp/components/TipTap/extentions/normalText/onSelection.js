import { TextSelection } from '@tiptap/pm/state'
import { getSelectionBlocks, getRangeBlocks, getPrevHeadingList, findPrevBlock } from '../helper'

const processHeadings = (state, tr, mapHPost, contentWrapperHeadings) => {
  for (let heading of contentWrapperHeadings) {
    if (!heading.le)
      heading = {
        ...heading,
        le: heading.content[0].attrs.level,
        startBlockPos: 0
      }

    const startBlock = mapHPost[0].startBlockPos
    const endBlock = tr.mapping.map(mapHPost.at(0).endBlockPos)

    mapHPost = getPrevHeadingList(tr, startBlock, endBlock)

    const node = state.schema.nodeFromJSON(heading)

    let { prevBlock, shouldNested } = findPrevBlock(mapHPost, heading.le)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }
}

const onSelection = (arrg) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, $anchor, from, to } = selection
  const { start } = $from.blockRange($to)

  const currentHLevel = $from.parent.attrs.level
  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  let titleStartPos = $from.start(1) - 1
  let titleEndPos = titleStartPos + titleNode.content.size
  const prevHStartPos = 0

  const selectionFirstLinePos = $from.pos - $from.parentOffset

  const selectedContents = getSelectionBlocks(doc, selectionFirstLinePos - 1, to)
  const lastHeadingInSelection = selectedContents.findLast((x) =>
    Object.prototype.hasOwnProperty.call(x, 'attrs')
  )
  const lastHeadingIndex = selectedContents.findLastIndex((x) =>
    Object.prototype.hasOwnProperty.call(x, 'attrs')
  )

  // on selection we have Heading level 1
  if (titleEndPos < to) {
    const getTitleBlock = selectedContents.findLast((x) => x.level === 1)

    titleEndPos = getTitleBlock.startBlockPos + doc.nodeAt(getTitleBlock.startBlockPos - 1).nodeSize - 1
  }

  // select rest of contents
  const contentWrapper = getRangeBlocks(doc, lastHeadingInSelection.startBlockPos, titleEndPos)
  const contentWrapperParagraphs = contentWrapper.filter((x) => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === 'heading')

  const normalizeSelectedContents = [
    ...[...selectedContents].splice(0, lastHeadingIndex + 1),
    ...contentWrapperParagraphs
  ]

  const containLevelOneHeading = selectedContents.find((x) => x.level === 1)

  const normalizeSelectedContentsBlocks = normalizeSelectedContents.map((node) =>
    state.schema.nodeFromJSON(node)
  )

  if (!containLevelOneHeading) {
    doc.nodesBetween(titleStartPos, start - 1, function (node, pos) {
      if (node.type.name === 'heading') {
        const headingLevel = node.firstChild?.attrs?.level

        if (headingLevel === currentHLevel) {
          titleStartPos = pos
          // INFO: I need the pos of last content in contentWrapper
          titleEndPos = pos + node.content.size
        }
      }
    })
  } else {
    const backspaceAction = doc.nodeAt(from) === null && $anchor.parentOffset === 0
    tr.delete(backspaceAction ? start - 1 : start - 1, titleEndPos)

    doc.nodesBetween($from.start(0), start - 1, function (node, pos) {
      if (node.type.name === 'heading') {
        const headingLevel = node.firstChild?.attrs?.level

        if (headingLevel === currentHLevel) {
          titleStartPos = pos
          titleEndPos = pos + node.content.size
        }
      }
    })
  }

  const titleHMap = getPrevHeadingList(tr, titleStartPos, tr.mapping.map(titleEndPos))
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)

  // insert normalizeSelectedContentsBlocks
  if (!containLevelOneHeading) {
    tr.delete(selectionFirstLinePos, titleEndPos)
    tr.insert(tr.mapping.map(selectionFirstLinePos) - 1, normalizeSelectedContentsBlocks)
  } else {
    const comingLevel = mapHPost.at(-1).le + 1
    let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

    const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

    tr.insert(tr.mapping.map(insertPos), normalizeSelectedContentsBlocks)
  }

  // update selection position
  const focusSelection = new TextSelection(tr.doc.resolve(from))
  tr.setSelection(focusSelection)

  if (!mapHPost.length) mapHPost = titleHMap

  processHeadings(state, tr, mapHPost, contentWrapperHeadings)

  return true
}

export default onSelection
