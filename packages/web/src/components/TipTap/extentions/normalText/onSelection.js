import { getSelectionBlocks, getRangeBlocks, getPrevHeadingList } from '../helper'

export default (arrg) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, $head } = selection
  const { start, end, depth } = $from.blockRange($to)

  const selectedContents = getSelectionBlocks(doc, start, end)
  const contentWrapper = getRangeBlocks(doc, start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)
  const restContent = getRangeBlocks(doc, end, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  console.log({
    start1: $from.pos,
    end1: $head.pos,
    start,
    end,
    selectedContents,
    contentWrapper,
    restContent
  })

  // return

  const newTr = tr

  const currentHLevel = $from.parent.attrs.level
  let titleStartPos = 0
  let titleEndPos = 0
  const titleHMap = []
  const prevHStartPos = 0
  const prevHEndPos = 0

  doc.nodesBetween($from.start(0), start - 1, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
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

  const lastBlock = titleHMap[titleHMap.length - 1]

  // return

  console.log(restContent, [...selectedContents])

  const newContent = selectedContents.map(x => editor.schema.nodeFromJSON(x))

  newTr.delete(start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  let insertPosition = start - 1

  if (currentHLevel < lastBlock.le) {
    // selectionEndPos = firstHeadingPicked.endBlockPos - 2
    insertPosition = lastBlock.endBlockPos - 2
  }

  // newTr.delete(start - 1, selectionEndPos)
  // newTr.insert(insertPosition, normalContents)

  console.log(doc.nodeAt(insertPosition))

  if (newTr.doc.nodeAt(insertPosition) === null && doc.nodeAt(insertPosition)?.type.name === 'contentWrapper') {
    console.log('im in')
    const contentWrapperNode = state.schema.nodeFromJSON({
      type: 'contentWrapper',
      content: [
        {
          type: 'paragraph'
        }
      ]

    })

    newTr.insert(newTr.mapping.map(insertPosition), contentWrapperNode)
      .insert(newTr.mapping.map(insertPosition) - 3, newContent)
  } else {
    newTr.insert(newTr.mapping.map(insertPosition), newContent)
  }

  console.log({
    restContent,
    newContent,
    lastBlock
  })

  // return

  let mapHPost = titleHMap
  let shouldNested = false

  if (contentWrapper.length > 0) {
    for (let [index, heading] of restContent.entries()) {
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
        narrowDownSearch
      })

      // return

      if (narrowDownSearch.length > 0) mapHPost = narrowDownSearch

      const node = state.schema.nodeFromJSON(heading)

      const prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
      const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
      const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
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

  return

  // newTr.insert(start, newContent)

  newTr.insert(newTr.mapping.map(start - 1), paragraphNode)

  const paragraphs = selectedContents.filter(x => x.type !== 'heading')
  const headings = selectedContents.filter(x => x.type === 'heading')

  const lolo = []

  const flatHeading = (heading) => {
    const headingText = heading.content[0].content
    const wrapperContent = heading.content[1].content
    const mergeContent = [...headingText, ...wrapperContent]

    console.log(mergeContent)

    for (const [index, block] of mergeContent.entries()) {
      if (block.type === 'heading') headingsMap.push({ block, index })
    }

    // const hasHeadingAgain = mergeContent.some(x=>x.type === 'heading')
    // if (hasHeadingAgain) flatHeading()
  }

  flatHeading(headings[0])

  console.log('=')
  let newSelection = [].concat(...selectedContents)

  const headingsMap = []

  for (const [index, block] of newSelection.entries()) {
    if (block.type === 'heading') headingsMap.push({ block, index })
  }

  for (const [index, heading] of headingsMap.entries()) {
    const headingText = heading.block.content[0].content
    const wrapperContent = heading.block.content[1].content
    const mergeContent = [...headingText, ...wrapperContent]

    // mergeContent.push(headingText)
    // mergeContent.push(wrapperContent)
    // console.log(mergeContent)
    newSelection.splice(heading.index, 0, mergeContent)
    newSelection = [].concat(...newSelection)
  }
}
