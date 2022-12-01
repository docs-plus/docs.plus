import { Node, Fragment, Slice, DOMSerializer } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';

export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state;
  const { $from, $to, $anchor, $cursor } = selection;
  const { start, end, depth } = $from.blockRange($to);

  console.log("[Heading]: forward process, commingLevel > currentHLevel")

  const commingLevel = attributes.level;
  const content = { "type": "text", "text": $anchor.nodeBefore.text }
  // select the first paragraph for heading title
  const headingContent = content

  const block = {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1),
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1,
    },
    ancesster: {
      start: $from.start(1),
      end: $from.end(1)
    },
    end: $from.end(depth),
    start: $from.start(depth),
    nextLevel: 0,
    depth,
    headingContent,
    lineContent: content,
    empty: {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": " "
        }
      ]
    },
    paragraph: { "type": "paragraph", }
  }

  const nextSiblingLevel = $from.doc.nodeAt(block.end + 1)?.firstChild.attrs.level
  const currentHeading = $from.doc.nodeAt(block.start)
  const currentHLevel = $from.doc.nodeAt(block.start).attrs.level

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = []
  const titleHMap = []
  let firstHEading = true
  let prevDepth = 0


  doc.nodesBetween(titleStartPos, titleEndPos, function (node, pos, parent, index) {
    if (node.type.name === "heading") {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth
      titleHMap.push({ le: headingLevel, node: node.toJSON(), depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
    }
  })

  doc.nodesBetween(start - 1, titleEndPos, function (node, pos, parent, index) {
    if (pos < start) return
    if (node.type.name === "paragraph" && firstHEading) {
      const depth = doc.resolve(pos).depth
      contentWrapper.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
    }
    if (node.type.name === "heading") {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth
      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        contentWrapper.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
        prevDepth = depth
      }
    }
  })

  const contentWrapperParagraphs = contentWrapper.filter(x => x.type === "paragraph")
  const contentWrapperHeadings = contentWrapper.filter(x => x.type === "heading" && x.le >= currentHLevel)


  let prevHStartPos = 0
  let prevHEndPos = 0


  doc.nodesBetween(titleStartPos, start - 1, function (node, pos, parent, index) {
    if (node.type.name === "heading") {
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
  let prevBlock = mapHPost.find(x => x.le >= commingLevel)

  const afterBlock = mapHPost.findLast(x => x.le <= commingLevel)

  console.log({
    prevBlock,
    afterBlock,
    mapHPost, titleHMap
  })

  if (afterBlock && commingLevel >= currentHLevel) {
    console.log("wroorwowro")
    if (commingLevel !== afterBlock.le) shouldNested = true
    prevBlock = afterBlock
  }

  console.log({ prevBlock, afterBlock, currentHLevel, commingLevel, alevel: afterBlock?.le })

  const sameLevelAtDepth = mapHPost.filter(x => x.le >= commingLevel && x.depth === prevBlock.depth)
  if (sameLevelAtDepth.length >= 3) prevBlock = sameLevelAtDepth[sameLevelAtDepth.length - 1]

  if (!prevBlock) {
    shouldNested = true
    prevBlock = mapHPost.findLast(x => x.le <= commingLevel)
  }

  console.log({
    prevBlock,
    depth,
    sameLevelAtDepth,
    shouldNested,
    commingLevel,
    titleHMap,
    start: start - 1,
    nodeAt: doc.nodeAt(prevHStartPos),
    mapHPost,
    prevBlock,
    prevHEndPos,
    prevHStartPos,
    contentWrapper,
    contentWrapperHeadings,
    contentWrapperParagraphs,
    schema: schema.nodes.heading

  })

  const jsonNode = {
    type: 'heading',
    content: [
      {
        type: 'contentHeading',
        content: [block.headingContent],
        attrs: {
          level: attributes.level
        },
      },
      {
        type: 'contentWrapper',
        content: contentWrapperParagraphs
      },
    ],
  }

  const node = state.schema.nodeFromJSON(jsonNode)

  // first create the current heading with new level
  const newTr = tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)

  const contentHeadingNodeSize = prevBlock.endBlockPos + block.headingContent.text.length + 2
  const resolveContentHeadingPos = newTr.doc.resolve(contentHeadingNodeSize)
  const newTextSelection = new TextSelection(resolveContentHeadingPos)
  newTr.setSelection(newTextSelection)

  const getThePrevHeading = (start, from) => {
    const titleHMap = []
    newTr.doc.nodesBetween(start, from, function (node, pos, parent, index) {
      if (node.type.name === "heading") {
        const headingLevel = node.firstChild?.attrs?.level
        const depth = doc.resolve(pos).depth
        titleHMap.push({ le: headingLevel, node: node.toJSON(), depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
      }
    })
    return titleHMap
  }

  // then loop through the heading to append
  if (contentWrapperHeadings.length > 0 && contentWrapperHeadings[0].le !== currentHLevel) {
    for (let [index, heading] of contentWrapperHeadings.entries()) {
      mapHPost = getThePrevHeading(
        mapHPost[0].startBlockPos,
        mapHPost[0].startBlockPos + doc.nodeAt(mapHPost[0].startBlockPos).nodeSize + 2
      )

      // console.log("nodeAt", mapHPost[0].startBlockPos + doc.nodeAt(mapHPost[0].startBlockPos).nodeSize)


      const node = state.schema.nodeFromJSON(heading)
      // const lastNodeInserted = mapHPost[mapHPost.length - 1]


      let prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
      let prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
      let prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
      const lastbloc = mapHPost[mapHPost.length - 1]
      let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
      if (lastbloc.le <= heading.le) prevBlock = lastbloc
      if (prevBlock.le < heading.le) {
        shouldNested = true
      } else {
        shouldNested = false
      }

      // console.log("coming prevblock", { prevBlock, mapHPost })

      // let insertPos = newTr.mapping.map(prevBlock.endBlockPos)
      // let lastInsertPos = newTr.mapping.maps[newTr.mapping.maps.length - 1].ranges

      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)

      // console.log("=>", {
      //   heading,
      //   yes: prevBlock.le < heading.le,
      //   lastNodeInserted,
      //   shouldNested,
      //   insertPos,
      //   ww: newTr.mapping.maps,
      //   lastInsertPos,
      //   node,
      //   level: heading.le,
      //   prevBlock,
      //   mapHPost,
      //   prevBlockEqual,
      //   prevBlockGratherFromFirst,
      //   prevBlockGratherFromLast,
      // })

    }
  }

  return chain()
    .deleteRange({
      from: newTr.mapping.map(start - 1),
      to: newTr.mapping.map(block.end)
    })
    .run()

}
