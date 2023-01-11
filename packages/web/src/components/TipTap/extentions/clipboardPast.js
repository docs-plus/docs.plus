import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from "prosemirror-model"
import { getPrevHeadingList } from './helper'
import { TextSelection, Selection } from 'prosemirror-state';

export default (slice, editor) => {
  const { state, view } = editor;
  let { schema, selection, doc, tr } = state;


  // normilize the slice content


  const newTr = tr
  let newPosResolver;
  let $from = selection.$from
  let start = $from.pos


  // if user cursor is in the heading,
  // move the cursor to the contentWrapper and do the rest
  if ($from.parent.type.name === "contentHeading") {
    const firstLine = doc.nodeAt(start + 2)

    let resolveNextBlock = newTr.doc.resolve(start + 2)
    newPosResolver = resolveNextBlock

    // if the heading block does not contain contentWrapper as a first child
    // then create a contentWrapper block
    if (firstLine.type.name === 'heading') {
      const contentWrapperBlock = {
        type: 'contentWrapper',
        content: [
          {
            "type": "paragraph"
          },
        ]

      }

      const node = state.schema.nodeFromJSON(contentWrapperBlock)
      newTr.insert(start, node)
      resolveNextBlock = newTr.doc.resolve(start + 2)
    }

    // put the selection to the first line of contentWrapper block
    if (resolveNextBlock.parent.type.name === 'contentWrapper') {
      newTr.setSelection(TextSelection.near(resolveNextBlock))
    }
  }

  console.log({
    newPosResolver
  })

  if (newPosResolver)
    $from = (new Selection(
      newPosResolver,
      newPosResolver
    )).$from;

  start = $from.pos



  console.log({
    newTr,
    start,
    at: newTr.doc.nodeAt(start)
  })

  // return Slice.empty

  const hasContentHeading = slice.toJSON()

  console.log({ hasContentHeading, })

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = []
  const titleHMap = []
  let firstHEading = true
  let prevDepth = 0

  doc.nodesBetween(start, titleEndPos, function (node, pos, parent, index) {
    if (node.type.name === "heading") {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth
      titleHMap.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
    }
  })

  doc.nodesBetween(start, titleEndPos, function (node, pos, parent, index) {
    if (pos < start) return

    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = $from.sharedDepth(pos)
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


  let clipboardContents = slice.toJSON().content

  console.log(clipboardContents, "===b")

  let paragraphs = []
  let newContent = []
  let newHeading = {}
  let hasHeading = false

  clipboardContents.map((node, index) => {

    if (!hasHeading && node.type !== "contentHeading") {
      return paragraphs.push(editor.schema.nodeFromJSON(node))
    }

    if (node.type === "contentHeading") {
      hasHeading = true;
      if (newHeading?.type) {
        newContent.push(editor.schema.nodeFromJSON(newHeading))
        newHeading = {}
      }
      newHeading = {
        type: "heading",
        level: node?.attrs.level,
        content: [
          node,
          {
            type: 'contentWrapper',
            content: []
          },
        ]
      }
    } else {
      // console.log(newHeading)
      newHeading?.content[1].content.push(node)
    }

    if (index === clipboardContents.length - 1) {
      newContent?.push(editor.schema.nodeFromJSON(newHeading))
    }
  })


  let higherarchy = [
    ...newContent
  ]

  // console.log(higherarchy, paragraphs)

  // return Slice.empty


  let mapHPost = titleHMap

  console.log("=>", {
    data: slice.toJSON(),
    titleHMap,
    contentWrapper,
    mapHPost,
    higherarchy,
    slice
  })


  let shouldNested = false
  let startPos = start
  let initPos = 0
  let prevHeadingListStartPos = mapHPost[0].startBlockPos
  let prevHeadingListEndtPos = newTr.mapping.map(titleEndPos)

  // first append paragraphs
  // then insert heading

  // if there is a paragraphs that not belong to any heading, append them into the current heading
  // if (paragraphs.length > 0) {
  //   for (let paragraph of paragraphs) {
  //     // startPos += paragraph.nodeSize
  //   }
  // }

  newTr.insert(startPos, paragraphs)

  // newTr.insertText("Hello", newTr.mapping.map(titleEndPos))
  if (higherarchy.length > 0)
    newTr.delete(newTr.mapping.map(start), newTr.mapping.map(titleEndPos))
  else {
    newTr.setMeta('paste', true);
    view.dispatch(newTr)

    return Slice.empty
  }


  // return Slice.empty
  // paste the headings
  if (higherarchy.length > 0) {
    for (let [index, heading] of higherarchy.entries()) {

      console.log("=========== append clipboard Heading", {
        start, "doc.nodeSize": doc.nodeSize, "newTr.doc.nodeSize": newTr.doc.nodeSize, prevHeadingListStartPos, prevHeadingListEndtPos
      })

      if (index === 0) {
        mapHPost = getPrevHeadingList(
          newTr,
          newTr.mapping.map(prevHeadingListStartPos),
          newTr.mapping.map(prevHeadingListEndtPos - 5)
        )
      } else {
        mapHPost = getPrevHeadingList(
          newTr,
          (prevHeadingListStartPos),
          (prevHeadingListEndtPos - 5)
        )
      }


      // console.log("b", mapHPost, { prevHeadingListStartPos, prevHeadingListEndtPos })


      const commingLevel = heading.firstChild.attrs.level

      let prevBlock;
      if (commingLevel !== 1) {
        mapHPost = mapHPost.filter(x =>
          x.startBlockPos < startPos &&
          x.startBlockPos >= prevHStartPos
        )
        // console.log("a", mapHPost)

        let prevBlockEqual = mapHPost.findLast(x => x.le === commingLevel)
        let prevBlockGratherFromFirst = mapHPost.find(x => x.le >= commingLevel)
        let prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= commingLevel)
        const lastbloc = mapHPost[mapHPost.length - 1]
        prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
        if (lastbloc.le <= commingLevel) prevBlock = lastbloc
        if (prevBlock.le < commingLevel) {
          shouldNested = true
        } else {
          shouldNested = false
        }


        if (index === 0) {
          startPos = prevBlock.endBlockPos + heading.nodeSize
          initPos = prevBlock.endBlockPos
        } else {
          startPos += heading.nodeSize
          prevHeadingListEndtPos += heading.nodeSize
        }


      } else {
        prevBlock = mapHPost[0]
        shouldNested = false

        startPos = prevBlock.endBlockPos + heading.nodeSize
        prevHeadingListStartPos = prevBlock.endBlockPos + 4
        prevHeadingListEndtPos = prevBlock.endBlockPos + heading.nodeSize + 4
      }



      console.log({
        commingLevel,
        shouldNested,
        prevBlock,
        mapHPost, initPos
      })




      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), heading)

      if (higherarchy.length === index + 1) {

        const topSliceOfHeadings = contentWrapper.filter(x => x.type !== "heading")
        // console.log("last Item", index, higherarchy.length, higherarchy, topSliceOfHeadings)
        // console.log("insertAt:", prevBlock.endBlockPos - (shouldNested ? 2 : 0), "size:", heading.content.size, newTr.doc.nodeSize)

        const newParagraphs = topSliceOfHeadings.map(x => editor.schema.nodeFromJSON(x))


        // if (newParagraphs.length > 0) {
        // for (let paragraph of newParagraphs) {
        // startPos += paragraph.nodeSize
        // console.log(newParagraphs, "=-=-=-")
        newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0) + heading.content.size, newParagraphs)
        // }
        // }



        // console.log("heading", heading.content.addToEnd(newParagraphs[0]), newParagraphs)
        // newTr.insert(prevBlock.endBlockPos, topSliceOfHeadings)

        // heading.content.content.push(newParagraphs)

        // editor.chain().insertContentAt(prevBlock.endBlockPos, "<p>asdalskdjalksjdlakjsd</p>").run()
      }

      // if (index == 1)
      // return Slice.empty
    }
  }

  // return Slice.empty


  const headingContent = contentWrapper.filter(x => x.type === "heading")
  const topSliceOfHeadings = contentWrapper.filter(x => x.type !== "heading")

  // after past the heading, past the rest of paragraphs


  if (headingContent.length > 0) {
    for (let [index, heading] of headingContent.entries()) {

      console.log("=========== append deleted parts")

      mapHPost = getPrevHeadingList(
        newTr,
        newTr.mapping.map(mapHPost[0].startBlockPos),
        newTr.mapping.map(mapHPost[0].startBlockPos + newTr.doc.nodeAt(mapHPost[0].startBlockPos).nodeSize)
      )

      console.log({
        mapHPost,
        startPos
      })

      mapHPost = mapHPost.filter(x =>
        x.startBlockPos < startPos &&
        x.startBlockPos >= prevHStartPos
      )

      const node = state.schema.nodeFromJSON(heading)

      console.log({
        mapHPost,
        startPos,
        heading,
        node,
        size: heading.nodeSize
      })

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

      startPos += node.nodeSize

      console.log({
        prevBlockEqual,
        prevBlockGratherFromFirst,
        prevBlockGratherFromLast,
        mapHPost
      })

      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
    }
  }

  newTr.setMeta('paste', true);
  view.dispatch(newTr)
  return Slice.empty
}
