import { TextSelection } from '@tiptap/pm/state'
import {
  getPrevHeadingList,
  getHeadingsBlocksMap,
  findPrevBlock,
  getSelectionRangeBlocks,
  extractParagraphsAndHeadings
} from '../helper'
import onHeading from './onHeading'

const onSelection = ({ state, tr, editor }) => {
  const { selection, doc } = state
  const { $from, $to, from, to } = selection

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  const prevHStartPos = titleStartPos

  const selectedContents = getSelectionRangeBlocks(doc, from, to)

  if (selectedContents[0]?.level) {
    onHeading({ state, tr, editor })
    return true
  }

  const restSelectionContents = getSelectionRangeBlocks(doc, to, titleEndPos)
  restSelectionContents.shift()

  const [paragraphs, headings] = extractParagraphsAndHeadings(restSelectionContents)

  const newConent = [
    ...selectedContents.map((node) => state.schema.nodeFromJSON(node)),
    ...paragraphs.map((node) => state.schema.nodeFromJSON(node))
  ]

  const titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < to && x.startBlockPos >= prevHStartPos)

  tr.deleteRange(selectedContents.at(0).startBlockPos, titleEndPos)
  tr.insert(selectedContents.at(0).startBlockPos, newConent)

  // update selection position
  const focusSelection = new TextSelection(tr.doc.resolve(to))
  tr.setSelection(focusSelection)

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

  return true
}

export default onSelection
