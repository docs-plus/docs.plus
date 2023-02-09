import { Node, Fragment, Slice, DOMSerializer } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'

import { getPrevHeadingList } from './helper'

export default (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor } = selection
  const { start, end, depth } = $from.blockRange($to)

  console.log('[Heading]: change heading Level h1')

  const commingLevel = attributes.level
  const content = { type: 'text', text: doc?.nodeAt($anchor.pos)?.text || $anchor.nodeBefore?.text || ' ' }
  // select the first paragraph for heading title
  const headingContent = content

  const block = {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1)
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1
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
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: ' '
        }
      ]
    },
    paragraph: { type: 'paragraph' }
  }

  const nextSiblingLevel = $from.doc.nodeAt(block.end + 1)?.firstChild.attrs.level
  const currentHeading = $from.doc.nodeAt(block.start)
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

  const contentWrapper = []
  const titleHMap = []
  let firstHEading = true
  let prevDepth = 0

  // return

  doc.nodesBetween(titleStartPos, titleEndPos, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      titleHMap.push({ le: headingLevel, node: node.toJSON(), depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
    }
  })

  doc.nodesBetween(start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size, function (node, pos, parent, index) {
    if (pos < start) return
    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = doc.resolve(pos).depth

      contentWrapper.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
    }
    if (node.type.name === 'heading') {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        contentWrapper.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
        prevDepth = depth
      }
    }
  })

  const contentWrapperParagraphs = contentWrapper.filter(x => x.type !== 'heading')
  const contentWrapperHeadings = contentWrapper.filter(x => x.type === 'heading' && x.le >= currentHLevel)

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
  const lastbloc = mapHPost[mapHPost.length - 1]
  let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

  if (lastbloc.le <= commingLevel) prevBlock = lastbloc
  if (prevBlock.le < commingLevel) {
    shouldNested = true
  }

  console.log({
    lastbloc,
    prevBlock,
    prevBlockEqual,
    prevBlockGratherFromFirst,
    prevBlockGratherFromLast,
    depth,
    shouldNested,
    commingLevel,
    titleHMap,
    mapHPost,
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
        }
      },
      {
        type: 'contentWrapper',
        content: contentWrapperParagraphs
      }
    ]
  }
  const node = state.schema.nodeFromJSON(jsonNode)
  // first create the current heading with new level
  const newTr = tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)

  const contentHeadingNodeSize = prevBlock.endBlockPos + block.headingContent.text.length + 2
  const resolveContentHeadingPos = newTr.doc.resolve(contentHeadingNodeSize)
  const newTextSelection = new TextSelection(resolveContentHeadingPos)

  newTr.setSelection(newTextSelection)

  // FIXME: this loop so much heavy, I need to find better solotion!
  // then loop through the heading to append
  if (contentWrapperHeadings.length > 0 && contentWrapperHeadings[0].le !== currentHLevel) {
    for (const [index, heading] of contentWrapperHeadings.entries()) {
      mapHPost = getPrevHeadingList(
        newTr,
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
      const lastbloc = mapHPost[mapHPost.length - 1]
      let prevBlock = prevBlockEqual || prevBlockGratherFromLast || prevBlockGratherFromFirst

      if (lastbloc.le <= heading.le) prevBlock = lastbloc
      if (prevBlock.le < heading.le) {
        shouldNested = true
      } else {
        shouldNested = false
      }

      newTr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
    }
  }

  return chain()
    .deleteRange({ from: newTr.mapping.map(start - 1), to: newTr.mapping.map(block.end) })
    .scrollIntoView()
    .run()
}
