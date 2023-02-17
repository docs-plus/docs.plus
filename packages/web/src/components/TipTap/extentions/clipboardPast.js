import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from 'prosemirror-model'
import { TextSelection, Selection } from 'prosemirror-state'

import { getRangeBlocks, getPrevHeadingList } from './helper'

export default (slice, editor) => {
  const { state, view } = editor
  const { schema, selection, doc, tr } = state

  // normilize the slice content

  const newTr = tr
  let newPosResolver
  let $from = selection.$from
  let start = $from.pos

  // if user cursor is in the heading,
  // move the cursor to the contentWrapper and do the rest
  if ($from.parent.type.name === 'contentHeading') {
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
            type: 'paragraph'
          }
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

  // If caret selection move to contentWrapper, create a new selection
  if (newPosResolver) {
    $from = (new Selection(
      newPosResolver,
      newPosResolver
    )).$from
  }

  start = $from.pos

  // return Slice.empty
  const hasContentHeading = slice.toJSON()

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)
  const titleHMap = getPrevHeadingList(tr, start, titleEndPos)

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

  const clipboardContents = slice.toJSON().content

  function normalizeClipboardContents(clipboardContents, editor) {
    const paragraphs = []
    const headings = []
    let heading = null

    for (const node of clipboardContents) {
      if (!heading && node.type !== 'contentHeading') {
        paragraphs.push(editor.schema.nodeFromJSON(node))
      }

      if (node.type === 'contentHeading') {
        // if new heading is found, push the previous heading into the heading list
        // and reset the heading
        if (heading) {
          headings.push(editor.schema.nodeFromJSON(heading))
          heading = null
        }
        heading = {
          type: 'heading',
          attrs: { level: node?.attrs.level },
          content: [
            node,
            {
              type: 'contentWrapper',
              content: []
            }
          ]
        }
      } else {
        heading?.content.at(1).content.push(node)
      }
    }

    if (heading) {
      headings.push(editor.schema.nodeFromJSON(heading))
    }

    return [paragraphs, headings]
  }

  // return Slice.empty

  const [paragraphs, headings] = normalizeClipboardContents(clipboardContents, state)

  const higherarchy = [
    ...headings
  ]

  // return Slice.empty

  let mapHPost = titleHMap

  let shouldNested = false
  let startPos = start
  let initPos = 0
  let prevHeadingListStartPos = mapHPost[0].startBlockPos
  let prevHeadingListEndtPos = newTr.mapping.map(titleEndPos)

  // first append the paragraphs in the current selection
  newTr.insert(startPos, paragraphs)

  // if higherarchy is empty, then just return
  if (higherarchy.length <= 0) {
    newTr.setMeta('paste', true)
    view.dispatch(newTr)

    return Slice.empty
  }

  newTr.delete(newTr.mapping.map(start), newTr.mapping.map(titleEndPos))

  // return Slice.empty

  // paste the headings
  for (const [index, heading] of higherarchy.entries()) {
    const commingLevel = heading.firstChild.attrs.level
    let prevBlock

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

    if (commingLevel === 1) {
      prevBlock = mapHPost[0]
      shouldNested = false

      startPos = prevBlock.endBlockPos + heading.nodeSize
      prevHeadingListStartPos = prevBlock.endBlockPos + 4
      prevHeadingListEndtPos = prevBlock.endBlockPos + heading.nodeSize + 4
    } else {
      mapHPost = mapHPost.filter(x =>
        x.startBlockPos < startPos &&
        x.startBlockPos >= prevHStartPos
      )

      const prevBlockEqual = mapHPost.findLast(x => x.le === commingLevel)
      const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= commingLevel)
      const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= commingLevel)
      const lastBlock = mapHPost.at(-1)

      prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst
      if (lastBlock.le <= commingLevel) prevBlock = lastBlock
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
    }

    newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), heading)

    if (higherarchy.length === index + 1) {
      const topSliceOfHeadings = contentWrapper.filter(x => x.type !== 'heading')
      const newParagraphs = topSliceOfHeadings.map(x => editor.schema.nodeFromJSON(x))

      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0) + heading.content.size, newParagraphs)
    }

    // if (index === 2) return Slice.empty
  }

  // return Slice.empty
  const headingContent = contentWrapper.filter(x => x.type === 'heading')

  // after past the clipboard contents, past the rest of paragraphs if it's not empty
  for (const [index, heading] of headingContent.entries()) {
    mapHPost = getPrevHeadingList(
      newTr,
      prevHeadingListStartPos,
      prevHeadingListEndtPos
    )

    mapHPost = mapHPost.filter(x =>
      x.startBlockPos < startPos &&
      x.startBlockPos >= prevHStartPos
    )

    const node = state.schema.nodeFromJSON(heading)

    const prevBlockEqual = mapHPost.findLast(x => x.le === heading.le)
    const prevBlockGratherFromFirst = mapHPost.find(x => x.le >= heading.le)
    const prevBlockGratherFromLast = mapHPost.findLast(x => x.le <= heading.le)
    const lastbloc = mapHPost.at(-1)
    let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

    if (lastbloc.le <= heading.le) prevBlock = lastbloc

    // eslint-disable-next-line
    shouldNested = prevBlock.le < heading.le ? true : false

    startPos += node.nodeSize

    newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  newTr.setMeta('paste', true)
  view.dispatch(newTr)

  return Slice.empty
}
