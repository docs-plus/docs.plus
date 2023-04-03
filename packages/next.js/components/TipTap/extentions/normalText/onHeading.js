import { TextSelection } from 'prosemirror-state'

import { getRangeBlocks, getPrevHeadingList } from '../helper'

export default (arrg) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, $head, from } = selection
  const { start, end, depth } = $from.blockRange($to)

  if (doc?.nodeAt(start).type.name !== 'contentHeading') {
    return console.info('[Heading]: not heading')
  }

  const headingText = { type: 'text', text: doc?.nodeAt($anchor.pos)?.text || $anchor.nodeBefore?.text || ' ' }

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  let titleStartPos = $from.start(1) - 1
  let titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)
  const currentHLevel = $from.parent.attrs.level

  let prevHStartPos = 0
  let prevHEndPos = 0

  const backspaceAction = doc.nodeAt(from) === null && $anchor.parentOffset === 0

  tr.delete(backspaceAction ? start - 1 : start - 1, titleEndPos)

  // if the current heading is not H1, otherwise we need to find the previous H1
  if (currentHLevel !== 1) {
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
  } else {
    doc.nodesBetween($from.start(0), start - 1, function (node, pos, parent, index) {
      if (node.type.name === 'heading') {
        const headingLevel = node.firstChild?.attrs?.level

        if (headingLevel === currentHLevel) {
          titleStartPos = pos
          titleEndPos = pos + node.content.size
        }
      }
    })
  }

  const contentWrapperParagraphs = contentWrapper.filter(x => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter(x => x.type === 'heading')
  const normalContents = [headingText, ...contentWrapperParagraphs]
    .map(x => editor.schema.nodeFromJSON(x))

  // this is for backspace, if the node is empty remove the TextNode
  if (backspaceAction) normalContents.shift()

  const titleHMap = getPrevHeadingList(tr, titleStartPos, tr.mapping.map(titleEndPos))

  let mapHPost = titleHMap.filter(x =>
    x.startBlockPos < start - 1 &&
    x.startBlockPos >= prevHStartPos
  )

  let shouldNested = false

  const comingLevel = mapHPost.at(-1).le + 1

  const prevBlockEqual = mapHPost.findLast(x => x.le === comingLevel)
  const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= comingLevel)
  const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= comingLevel)
  const lastbloc = mapHPost.at(-1)
  let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

  if (lastbloc.le <= comingLevel) prevBlock = lastbloc
  shouldNested = prevBlock.le < comingLevel

  const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  tr.insert(tr.mapping.map(insertPos), normalContents)

  const focusSelection = new TextSelection(tr.doc.resolve(insertPos + 1))

  tr.setSelection(focusSelection)

  for (let heading of contentWrapperHeadings) {
    if (!heading.le) heading = { ...heading, le: heading.content[0].attrs.level, startBlockPos: 0 }

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

  return (backspaceAction) ? view.dispatch(tr) : true
}
