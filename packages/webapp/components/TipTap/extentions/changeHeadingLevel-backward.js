import { TextSelection } from '@tiptap/pm/state'

import { getRangeBlocks, getHeadingsBlocksMap, createThisBlockMap } from './helper'

const changeHeadingLevelBackward = (arrg, attributes, asWrapper = false) => {
  const { state, tr } = arrg
  const { selection, doc } = state
  const { $from, $to, $anchor, from } = selection
  const { start, end, depth } = $from.blockRange($to)

  console.info('[Heading]: Backward process,  comingLevel < currentHLevel')

  const comingLevel = attributes.level
  const caretSelectionTextBlock = {
    type: 'text',
    text:
      doc.textBetween($from.pos, $to.pos, ' ') ||
      doc?.nodeAt($anchor.pos)?.text ||
      $anchor.nodeBefore?.text ||
      ' '
  }

  const block = createThisBlockMap($from, depth, caretSelectionTextBlock)
  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNode.content.size
  const contentWrapper = getRangeBlocks(doc, end, titleEndPos)
  const titleHMap = getHeadingsBlocksMap(doc, start, titleEndPos)

  const sliceTargetContent = contentWrapper.filter((x) => {
    if (x.type !== 'heading') return x

    return x.le > comingLevel
  })

  // remove the first paragraph, if the request is to wrap the content
  if (asWrapper) {
    const pickedNode = sliceTargetContent.shift()

    if (sliceTargetContent.length === 0) {
      sliceTargetContent.push({ ...pickedNode, content: [block.paragraph] })
    }
  }

  const endSliceBlocPos = sliceTargetContent[sliceTargetContent.length - 1].endBlockPos
  const insertPos = titleHMap
    .filter((x) => endSliceBlocPos <= x.endBlockPos)
    .find((x) => x.le >= comingLevel)?.endBlockPos

  const jsonNewBlock = {
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

  const node = state.schema.nodeFromJSON(jsonNewBlock)

  const newTr = tr.insert(insertPos, node)

  const newTextSelection = new TextSelection(newTr.doc.resolve(from))

  newTr.setSelection(newTextSelection)
  newTr.deleteRange(start - 1, insertPos)

  return true
}

export default changeHeadingLevelBackward
