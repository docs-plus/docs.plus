import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getPrevHeadingList,
  getHeadingsBlocksMap,
  findPrevBlock,
  getSelectionRangeBlocks,
  extractParagraphsAndHeadings
} from './helper'

const processRemainingHeadings = ({ state, tr, headings, titleStartPos, titleEndPos }) => {
  let mapHPost = getHeadingsBlocksMap(state.doc, titleStartPos, titleEndPos)
  mapHPost = mapHPost.filter(
    (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
  )

  for (const heading of headings) {
    const commingLevel = heading.level || heading.content.at(0).level
    mapHPost = getPrevHeadingList(tr, mapHPost[0].startBlockPos, tr.mapping.map(mapHPost[0].endBlockPos))
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < heading.startBlockPos && x.startBlockPos >= titleStartPos
    )

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), state.schema.nodeFromJSON(heading))
  }
}

const deleteSelectedRange = ({ state, tr, editor }) => {
  const { selection, doc } = state
  const { $from, $to, from, to } = selection
  const blockRange = $from.blockRange($to)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  const selectedContents = getSelectionRangeBlocks(doc, from, to)
  const restSelectionContents = getSelectionRangeBlocks(doc, to, titleEndPos)
  restSelectionContents.shift()

  const [paragraphs, headings] = extractParagraphsAndHeadings(restSelectionContents)

  const newConent = [
    ...selectedContents.map((node) => state.schema.nodeFromJSON(node)),
    ...paragraphs.map((node) => state.schema.nodeFromJSON(node))
  ]

  if (blockRange.$from.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    const selectedFirstBlockPos = selectedContents.at(0).startBlockPos
    let node

    tr.deleteRange(selectedFirstBlockPos - 1, titleEndPos)
    newConent.shift()

    const attrLevel = blockRange.parent.attrs.level || blockRange.$from.parent.attrs.level
    let jsonNode = {
      type: ENUMS.NODES.HEADING_TYPE,
      attrs: {
        level: attrLevel
      },
      content: [
        {
          type: ENUMS.NODES.CONTENT_HEADING_TYPE,
          content: [blockRange.$from?.nodeBefore?.toJSON() || blockRange.$to?.nodeAfter?.toJSON()],
          attrs: {
            level: attrLevel
          }
        },
        {
          type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
          content: [...paragraphs]
        }
      ]
    }
    const headingTypeContent = jsonNode.content.at(0).content.at(0)

    if (headingTypeContent && blockRange.$to?.nodeAfter) {
      jsonNode.content.at(1).content.unshift({
        type: ENUMS.NODES.PARAGRAPH_TYPE,
        content: [blockRange.$to?.nodeAfter?.toJSON()]
      })
    }

    const insertPos = selectedFirstBlockPos - 1

    if (headingTypeContent === undefined) {
      node = [...paragraphs].map((node) => state.schema.nodeFromJSON(node))
    } else {
      node = state.schema.nodeFromJSON(jsonNode)
    }

    tr.insert(insertPos, node)

    // update selection position
    const focusSelection = new TextSelection(tr.doc.resolve(from || 0))
    tr.setSelection(focusSelection)
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

  processRemainingHeadings({ state, tr, headings, titleStartPos, titleEndPos })

  if (tr) editor.view?.dispatch(tr)
  return true
}

export default deleteSelectedRange
