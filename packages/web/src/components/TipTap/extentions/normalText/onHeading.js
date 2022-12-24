import { getSelectionBlocks, getRangeBlocks, getPrevHeadingList } from '../helper'

export default (arrg) => {

  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state;
  const { $from, $to, $anchor, $cursor, $head } = selection;
  const { start, end, depth } = $from.blockRange($to);



  let selectedContents = getSelectionBlocks(doc, start, $head.pos)
  let contentWrapper = getRangeBlocks(doc, start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  console.log("1=>", {
    selection,
    $from,
    start, end, depth,
    contentWrapper,
    selectedContents
  })

  const paragraphNode = state.schema.nodeFromJSON({ "type": "paragraph" })

  const newTr = tr

  // newTr.delete(start - 1, $from.end(depth - 1) + 1)
  // newTr.insert(newTr.mapping.map(start - 1), paragraphNode)

  const currentHLevel = $from.parent.attrs.level
  let titleStartPos = 0
  let titleEndPos = 0
  const titleHMap = []
  let prevHStartPos = 0
  let prevHEndPos = 0


  doc.nodesBetween($from.start(0), start - 1, function (node, pos, parent, index) {
    if (node.type.name === "heading") {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth
      titleHMap.push({ le: headingLevel, node: node.toJSON(), depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })

      if (headingLevel === currentHLevel) {
        titleStartPos = pos
        // INFO: I need the pos of last content in contentWrapper
        titleEndPos = pos + node.content.size
      }
    }
  })

  doc.nodesBetween(titleStartPos, start - 1, function (node, pos, parent, index) {
    if (node.type.name === "heading") {
      const depth = doc.resolve(pos).depth
      // INFO: this the trick I've looking for
      if (depth === 2) {
        // console.log()
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  const headText = contentWrapper[0].content[0].content
  const paragraphs = contentWrapper[0].content[1].content.filter(x => x.type !== 'heading')
  const headingslice = contentWrapper[0].content[1].content.filter(x => x.type === 'heading')

  const firstHeadingPicked = contentWrapper.shift()

  const newSlice = [...headText, ...paragraphs,]
  const lastBlock = titleHMap[titleHMap.length - 1]

  // I have to remove the hadingslice and append it to wrapper
  // the problame is I don't have the position block

  // let prevBlockEqual = titleHMap.findLast(x => x.le === commingLevel)
  // let prevBlockGratherFromFirst = titleHMap.find(x => x.le >= commingLevel)
  // let prevBlockGratherFromLast = titleHMap.findLast(x => x.le <= commingLevel)
  // const lastbloc = titleHMap[titleHMap.length - 1]
  // let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
  // if (lastbloc.le <= commingLevel) prevBlock = lastbloc
  // if (prevBlock.le < commingLevel) {
  //   shouldNested = true
  // }

  let selectionEndPos = firstHeadingPicked.endBlockPos - 2
  // const

  console.log(contentWrapper)

  // if (firstHeadingPicked.depth === 2)
  selectionEndPos = contentWrapper.length > 0 ?
    contentWrapper[contentWrapper.length - 1].endBlockPos :
    lastBlock.endBlockPos


  // if (firstHeadingPicked.depth !== 2) selectionEndPos = selectionEndPos - 2


  contentWrapper = [...headingslice, ...contentWrapper]

  console.log("2=>", {
    contentWrapper,
    headText,
    paragraphs,
    headingslice,
    newSlice,
    lastBlock,
    titleHMap,
    contentWrapper,
    r: contentWrapper[contentWrapper.length - 1]?.endBlockPos,
    selectionEndPos,
    start,
    headingslice,
    firstHeadingPicked,
    ga: newSlice.map(x => editor.schema.nodeFromJSON(x))
  })


  const normalContents = newSlice.map(x => editor.schema.nodeFromJSON(x))

  let insertPosition = start - 1
  if (currentHLevel < lastBlock.le) {
    selectionEndPos = firstHeadingPicked.endBlockPos - 2
    insertPosition = lastBlock.endBlockPos - 2
  }

  newTr.delete(start - 1, selectionEndPos)
  newTr.insert(insertPosition, normalContents)

  // return

  // prevHStartPos = start

  let mapHPost = titleHMap
  let shouldNested = false
  console.log("before LOOOP: ==>>", contentWrapper)
  if (contentWrapper.length > 0) {
    for (let [index, heading] of contentWrapper.entries()) {

      if (!heading.le) heading = { ...heading, le: heading.content[0].attrs.level, startBlockPos: 0 }



      if (index == 0) {
        const startBlock = newTr.mapping.map(mapHPost[0].startBlockPos)
        const endBlock = startBlock + newTr.doc.nodeAt(startBlock).nodeSize
        // console.log({
        //   startBlock,
        //   endBlock,
        //   mapHPost,
        //   node: newTr.doc.nodeAt(startBlock),
        //   nodeEnd: newTr.doc.nodeAt(endBlock),
        // })

        mapHPost = getPrevHeadingList(
          newTr,
          startBlock,
          endBlock
        )

      } else {
        const startBlock = newTr.mapping.map(mapHPost[0].startBlockPos)
        const endBlock = (startBlock + newTr.doc.nodeAt(startBlock).nodeSize)
        // console.log({
        //   startBlock,
        //   endBlock,
        //   node: newTr.doc.nodeAt(startBlock),
        // })
        mapHPost = getPrevHeadingList(newTr, startBlock, endBlock)
      }

      console.log({
        mapHPost,
        heading,
        prevHStartPos,
        r: mapHPost.filter(x =>
          x.startBlockPos < heading.startBlockPos &&
          x.startBlockPos >= prevHStartPos
        )
      })


      // const narrowDownSearch = mapHPost.filter(x =>
      //   // x.startBlockPos < heading.startBlockPos &&
      //   x.startBlockPos <= prevHStartPos
      // )

      const narrowDownSearch = mapHPost

      console.log({
        heading,
        prevHStartPos1: newTr.mapping.map(prevHStartPos),
        prevHStartPos,
        at: newTr.doc.nodeAt(newTr.mapping.map(prevHStartPos)),
        mapHPost,
        narrowDownSearch,
      })

      // return

      if (narrowDownSearch.length > 0) mapHPost = narrowDownSearch


      const node = state.schema.nodeFromJSON(heading)

      let prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
      let prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
      let prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
      const lastbloc = mapHPost[mapHPost.length - 1]
      let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
      // console.log({ lastbloc, prevBlock, mapHPost })
      // if (!lastbloc) =
      if (lastbloc.le <= heading.le) prevBlock = lastbloc
      if (prevBlock.le < heading.le) {
        shouldNested = true
      } else {
        shouldNested = false
      }

      console.log({
        prevBlockEqual,
        prevBlockGratherFromFirst,
        prevBlockGratherFromLast,
        lastbloc,
        prevBlock,
        mapHPost,
        shouldNested
      })

      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
      // return
    }
  }


}
