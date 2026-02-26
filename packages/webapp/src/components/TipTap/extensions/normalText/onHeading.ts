import { TextSelection } from '@tiptap/pm/state'
import { type EditorState, TIPTAP_NODES, type Transaction, TRANSACTION_META } from '@types'
import { logger } from '@utils/logger'

import {
  convertHeadingsToParagraphs,
  findPrevBlock,
  getInsertionPos,
  getPrevHeadingList,
  getRangeBlocks,
  getSelectionRangeBlocks
} from '../helper'
import { isFirstHeadingInDocument } from '../helper/selection'
import { HeadingBlockInfo, NormalTextArgs, SelectionBlock } from '../types'

const processHeadings = (
  state: EditorState,
  tr: Transaction,
  headingPositions: HeadingBlockInfo[],
  headings: SelectionBlock[]
): boolean => {
  let currentHeadingPositions = headingPositions

  // Process each heading
  headings.forEach((heading) => {
    // Normalize heading structure
    const normalizedHeading = normalizeHeading(heading)

    // Calculate start and end block positions for mapping
    const startBlockPos = currentHeadingPositions[0].startBlockPos
    const endBlockPos = tr.mapping.map(currentHeadingPositions[0].endBlockPos)

    // Update the previous heading list
    currentHeadingPositions = getPrevHeadingList(tr, startBlockPos, endBlockPos)

    // Create a new node from the normalized heading
    const headingNode = state.schema.nodeFromJSON(normalizedHeading)

    const result = findPrevBlock(currentHeadingPositions, normalizedHeading.le)
    const headingInsertPos = getInsertionPos(result)
    if (headingInsertPos === null) return

    tr.insert(headingInsertPos, headingNode)
  })

  return true
}

// Normalize the heading object by setting default values if necessary
export const normalizeHeading = (heading: SelectionBlock): SelectionBlock & { le: number } => {
  const levelFromHeading = typeof heading.le === 'number' ? heading.le : heading.level
  const levelFromContent = heading.content?.[0]?.attrs?.level
  const normalizedLevel =
    typeof levelFromHeading === 'number'
      ? levelFromHeading
      : typeof levelFromContent === 'number'
        ? levelFromContent
        : 1

  return {
    ...heading,
    le: normalizedLevel,
    startBlockPos: heading.startBlockPos ?? 0
  }
}

// Separate content blocks into paragraphs and headings
export const partitionContentBlocks = (
  contentBlocks: SelectionBlock[]
): { paragraphs: SelectionBlock[]; headings: SelectionBlock[] } => {
  const paragraphs = contentBlocks.filter((block) => block.type !== TIPTAP_NODES.HEADING_TYPE)
  const headings = contentBlocks.filter((block) => block.type === TIPTAP_NODES.HEADING_TYPE)
  return { paragraphs, headings }
}

const onHeading = (args: NormalTextArgs): void => {
  const { editor, state, tr, backspaceAction } = args
  const { selection, doc } = state
  const { $from, $to, from, to } = selection

  if (isFirstHeadingInDocument(doc, $from.pos - $from.textOffset)) {
    logger.warn('[NormalText]: First heading title, skipping')
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
  const selectedHeadingLevel = doc.nodeAt(selectedStartPos)!.attrs.level

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

  const result = findPrevBlock([prevHeadingNode!], prevHeadingNode!.le + 1)
  const insertPos = getInsertionPos(result)
  if (insertPos === null) return

  // Insert the new nodes at the calculated position
  tr.insert(insertPos, contentNodes)

  // Set focus to the last paragraph
  const focusSelection = new TextSelection(tr.doc.resolve(insertPos + 1))
  tr.setSelection(focusSelection)

  // Process the remaining headings

  processHeadings(state, tr, [prevHeadingNode!], remainingHeadings)

  // Trigger TOC update
  tr.setMeta(TRANSACTION_META.RENDER_TOC, true)
  // Notify that new heading was created
  tr.setMeta(TRANSACTION_META.NEW_HEADING_CREATED, true)

  if (backspaceAction && tr) editor.view.dispatch(tr)
  return
}

export default onHeading
