import { TextSelection } from '@tiptap/pm/state'
import {
  getSelectionRangeBlocks,
  extractParagraphsAndHeadings,
  insertRemainingHeadings
} from '../helper'
import onHeading from './onHeading'

const onSelection = ({ state, tr, editor }) => {
  const { selection, doc } = state
  const { $from, $to, from, to } = selection

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  const prevHStartPos = titleStartPos

  const selectedContents = getSelectionRangeBlocks(doc, from, to)

  // check if the selected content start in contentheading/heading node
  if (selectedContents[0]?.level) {
    console.info('[Heading]: selected content start with heading node')
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

  tr.deleteRange(selectedContents.at(0).startBlockPos, titleEndPos)
  tr.insert(selectedContents.at(0).startBlockPos, newConent)

  // update selection position
  const focusSelection = new TextSelection(tr.doc.resolve(from))
  tr.setSelection(focusSelection)

  // after all that, we need to loop through the rest of remaing heading to append
  return insertRemainingHeadings({
    state,
    tr,
    headings,
    titleStartPos: tr.mapping.map(titleStartPos),
    titleEndPos: tr.mapping.map(titleEndPos),
    prevHStartPos: tr.mapping.map(prevHStartPos)
  })
}

export default onSelection
