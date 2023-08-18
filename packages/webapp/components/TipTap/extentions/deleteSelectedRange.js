import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getPrevHeadingList,
  getHeadingsBlocksMap,
  findPrevBlock,
  getSelectionRangeBlocks,
  extractParagraphsAndHeadings
} from './helper'

const deleteSelectedRange = ({ state, tr, editor }) => {
  const { selection, doc } = state
  const { $from, $to, from, to } = selection
  const blockRange = $from.blockRange($to)

  let { start } = $from.blockRange($to)
  start = start === 0 ? from : start
  const prevHStartPos = 0

  const titleNodeTo = $from.doc.nodeAt($to.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNodeTo.content.size

  const selectedContents = getSelectionRangeBlocks(doc, from, to)

  const restSelectionContents = getSelectionRangeBlocks(doc, to, titleEndPos)
  restSelectionContents.shift()

  const [paragraphs, headings] = extractParagraphsAndHeadings(restSelectionContents)

  const newConent = [
    ...selectedContents.map((node) => state.schema.nodeFromJSON(node)),
    ...paragraphs.map((node) => state.schema.nodeFromJSON(node))
  ]

  const titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)

  if (newConent.length === selectedContents.length) {
    tr.deleteRange(from, to)
    if (tr) editor.view?.dispatch(tr)
    return true
  }

  if (blockRange.$from.parent.type.name === 'contentHeading') {
    tr.deleteRange(selectedContents.at(0).startBlockPos - 1, titleEndPos)
    newConent.shift()

    const jsonNode = {
      type: ENUMS.NODES.HEADING_TYPE,
      content: [
        {
          type: ENUMS.NODES.CONTENT_HEADING_TYPE,
          content: [blockRange.$from?.nodeBefore?.toJSON()],
          attrs: {
            level: blockRange.parent.attrs.level || blockRange.$from.parent.attrs.level
          }
        },
        {
          type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
          content: [...paragraphs, ...headings]
        }
      ]
    }

    if (blockRange.$to?.nodeAfter) {
      jsonNode.content.at(1).content.unshift({
        type: ENUMS.NODES.PARAGRAPH_TYPE,
        content: [blockRange.$to?.nodeAfter?.toJSON()]
      })
    }

    const node = state.schema.nodeFromJSON(jsonNode)

    tr.insert(selectedContents.at(0).startBlockPos - 1, node)

    // update selection position
    const focusSelection = new TextSelection(tr.doc.resolve(selectedContents.at(0).startBlockPos - 1 || 0))
    tr.setSelection(focusSelection)

    if (tr) editor.view?.dispatch(tr)
    return true
  } else {
    tr.deleteRange(selectedContents.at(0).startBlockPos, titleEndPos)
    tr.insert(selectedContents.at(0).startBlockPos, newConent)
    tr.delete(from, tr.mapping.map(to))
    if (blockRange?.$to?.nodeBefore) {
      tr.insert(from, blockRange.$to.nodeAfter)
    }

    const insertPos = blockRange?.$to.nodeAfter ? blockRange?.$to?.nodeAfter.nodeSize : 0

    // update selection position
    const focusSelection = new TextSelection(tr.doc.resolve(from + insertPos || 0))
    tr.setSelection(focusSelection)

    tr.insert(
      from + insertPos,
      paragraphs.map((node) => state.schema.nodeFromJSON(node))
    )
  }

  // after all that, we need to loop through the rest of remaing heading to append
  for (const heading of headings) {
    const commingLevel = heading.level || heading.content.at(0).level

    mapHPost = getPrevHeadingList(tr, mapHPost[0].startBlockPos, tr.mapping.map(mapHPost[0].endBlockPos))
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < heading.startBlockPos && x.startBlockPos >= prevHStartPos
    )

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

    const node = state.schema.nodeFromJSON(heading)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  if (tr) editor.view?.dispatch(tr)
  return true
}

export default deleteSelectedRange
