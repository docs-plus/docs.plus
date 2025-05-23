import { TextSelection } from '@tiptap/pm/state'
import {
  getRangeBlocks,
  getPrevHeadingList,
  findPrevBlock,
  getSelectionRangeBlocks,
  convertHeadingsToParagraphs
} from '../helper'
import ENUMS from '../../enums'

const processHeadings = (state, tr, headingPositions, headings) => {
  // Process each heading
  headings.forEach((heading) => {
    // Normalize heading structure
    const normalizedHeading = normalizeHeading(heading)

    // Calculate start and end block positions for mapping
    const startBlockPos = headingPositions[0].startBlockPos
    const endBlockPos = tr.mapping.map(headingPositions[0].endBlockPos)

    // Update the previous heading list
    headingPositions = getPrevHeadingList(tr, startBlockPos, endBlockPos)

    // Create a new node from the normalized heading
    const headingNode = state.schema.nodeFromJSON(normalizedHeading)

    // Find the previous block and determine if it should be nested
    const { prevBlock, shouldNested } = findPrevBlock(headingPositions, normalizedHeading.le)

    // Insert the new node at the appropriate position
    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), headingNode)
  })

  return true
}

// Normalize the heading object by setting default values if necessary
const normalizeHeading = (heading) => {
  if (!heading.le) {
    return {
      ...heading,
      le: heading.content[0].attrs.level,
      startBlockPos: 0
    }
  }
  return heading
}

// Separate content blocks into paragraphs and headings
const partitionContentBlocks = (contentBlocks) => {
  const paragraphs = contentBlocks.filter((block) => block.type !== ENUMS.NODES.HEADING_TYPE)
  const headings = contentBlocks.filter((block) => block.type === ENUMS.NODES.HEADING_TYPE)
  return { paragraphs, headings }
}

const onHeading = (args) => {
  const { editor, state, tr, backspaceAction } = args
  const { selection, doc } = state
  const { $from, $to, from, to } = selection

  if ($from.pos - $from.textOffset === 2) {
    console.warn('[NormalText]: First heading title, skipping')
    return
  }

  // Calculate the position at the end of the title section
  const titleSectionEndPos = $to.end(1)

  // Get selected contents and the rest of the contents after the selection
  let selectedContents = getSelectionRangeBlocks(doc, from, to)
  let remainingContents = getRangeBlocks(doc, to + 1, titleSectionEndPos)
  // Convert the selected content to paragraphs
  selectedContents = convertHeadingsToParagraphs(selectedContents)

  // Separate the rest of the contents into paragraphs and headings
  const { paragraphs: remainingParagraphs, headings: remainingHeadings } =
    partitionContentBlocks(remainingContents)

  // Get the start position of the selected content
  const selectedStartPos = selectedContents[0].startBlockPos

  // Determine the heading level of the selected content
  const selectedHeadingLevel = doc.nodeAt(selectedStartPos).attrs.level

  // Calculate the start position of the previous heading nodes
  const prevHeadingNodesStartPos = selectedHeadingLevel === 1 ? $from.start(0) : $from.start(1)

  // Get the list of previous heading nodes
  let prevHeadingNodes = getPrevHeadingList(tr, prevHeadingNodesStartPos, from)
  let prevHeadingNode = prevHeadingNodes.at(-2) || prevHeadingNodes.at(-1)

  // Delete the selected heading and its content
  tr.delete($from.start($from.depth - 1) - 1, titleSectionEndPos)

  // Convert the selected contents and remaining paragraphs to nodes
  const contentNodes = [...selectedContents, ...remainingParagraphs].map((content) =>
    editor.schema.nodeFromJSON(content)
  )

  // Update the previous heading nodes with new positions after deletion
  prevHeadingNodes = getPrevHeadingList(
    tr,
    prevHeadingNodesStartPos,
    tr.mapping.map(titleSectionEndPos)
  )
  prevHeadingNode = prevHeadingNodes.at(-1)

  // Find the previous block and determine if it should be nested
  const { prevBlock, shouldNested } = findPrevBlock([prevHeadingNode], prevHeadingNode.le + 1)
  const insertPos = prevBlock.endBlockPos - (shouldNested ? 2 : 0)

  // Insert the new nodes at the calculated position
  tr.insert(insertPos, contentNodes)

  // Set focus to the last paragraph
  const focusSelection = new TextSelection(tr.doc.resolve(insertPos + 1))
  tr.setSelection(focusSelection)

  // Process the remaining headings

  processHeadings(state, tr, [prevBlock], remainingHeadings)

  // update TOC
  tr.setMeta('renderTOC', true)

  if (backspaceAction && tr) editor.view.dispatch(tr)
  return
}

export default onHeading
