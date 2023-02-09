import { TextSelection } from 'prosemirror-state'

export default (arrg, attributes, asWrapper = false) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor } = selection
  const { start, end, depth } = $from.blockRange($to)

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

  console.log('[Heading]: Forward process,  commingLevel < currentHLevel')
  // console.log("the hard path")

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = []
  const titleHMap = []
  let firstHEading = true
  let prevDepth = 0

  doc.nodesBetween(start, titleEndPos, function (node, pos, parent, index) {
    if (node.type.name === 'heading') {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      titleHMap.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
    }
  })

  doc.nodesBetween(start, titleEndPos, function (node, pos, parent, index) {
    if (pos < start) return

    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = $from.sharedDepth(pos)

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

  const sliceTargetContent = contentWrapper.filter(x => {
    if (x.type !== 'heading') return x

    return x.le > commingLevel
  })

  // remove the first paragraph, if the request is to wrap the content
  if (asWrapper) sliceTargetContent.shift()

  const endSliceBlocPos = sliceTargetContent[sliceTargetContent.length - 1].endBlockPos
  const insertPos = titleHMap
    .filter(x => endSliceBlocPos <= x.endBlockPos)
    .find(x => x.le >= commingLevel)?.endBlockPos

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
        content: sliceTargetContent
      }
    ]
  }

  const node = state.schema.nodeFromJSON(jsonNode)
  const newTr = tr.insert(insertPos, node)

  const contentHeadingNodeSize = insertPos + block.headingContent.text.length + 2
  const resolveContentHeadingPos = newTr.doc.resolve(contentHeadingNodeSize)
  const newTextSelection = new TextSelection(resolveContentHeadingPos)

  newTr.setSelection(newTextSelection)

  return chain()
    .deleteRange({ from: start - 1, to: insertPos })
    .scrollIntoView()
    .run()
}
