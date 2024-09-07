import { Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import {
  getSelectionRangeSlice,
  getHeadingsBlocksMap,
  findPrevBlock,
  getPrevHeadingPos
} from './helper'

// Helper function to create a node from JSON using the provided schema
const createNodeFromJSON = (node, schema) => schema.nodeFromJSON(node)

// Function to extract paragraphs and headings from clipboard contents
const extractParagraphsAndHeadings = (clipboardContents, { schema }) => {
  const paragraphs = []
  const headings = []
  let currentHeading = null

  // Iterate through clipboard contents and categorize nodes as paragraphs or headings
  clipboardContents.forEach((node) => {
    // If no heading is found and the node is not a heading type, treat it as a paragraph
    if (!currentHeading && node.type !== ENUMS.NODES.CONTENT_HEADING_TYPE) {
      paragraphs.push(createNodeFromJSON(node, schema))
    } else if (node.type === ENUMS.NODES.CONTENT_HEADING_TYPE) {
      // If a new heading is found, push the previous heading into the heading list and reset the heading
      if (currentHeading) {
        headings.push(createNodeFromJSON(currentHeading, schema))
      }
      currentHeading = {
        type: ENUMS.NODES.HEADING_TYPE,
        attrs: { level: node?.attrs.level, id: null },
        content: [
          node,
          {
            type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
            content: []
          }
        ]
      }
    } else {
      // If the node is not a heading, append it to the current heading's content
      currentHeading?.content[1].content.push(node)
    }
  })

  // Push the last heading into the headings array if it exists
  if (currentHeading) {
    headings.push(createNodeFromJSON(currentHeading, schema))
  }

  return [paragraphs, headings]
}

// Function to insert headings into the transaction at the appropriate positions
const insertHeadings = (
  tr,
  headings,
  lastBlockPos,
  lastH1Inserted,
  from,
  titleStartPos,
  prevHStartPos
) => {
  let mapHPost = {}

  // Iterate over each heading and insert it into the correct position
  headings.forEach((heading) => {
    const comingLevel = heading.attrs.level || heading.content.firstChild.attrs.level
    const startBlock =
      lastH1Inserted.startBlockPos === 0 ? tr.mapping.map(from) : lastH1Inserted.startBlockPos
    const endBlock =
      lastH1Inserted.endBlockPos === 0
        ? tr.mapping.map(from)
        : tr.doc.nodeAt(lastH1Inserted.startBlockPos).content.size + lastH1Inserted.startBlockPos

    // Get the map of headings blocks within the specified range
    mapHPost = getHeadingsBlocksMap(tr.doc, startBlock, endBlock).filter(
      (x) => x.startBlockPos >= (comingLevel === 1 ? titleStartPos : prevHStartPos)
    )

    // Find the previous block and determine if it should be nested
    let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

    // Find the last occurrence of the previous block level if there are duplicates
    const robob = mapHPost.filter((x) => prevBlock?.le === x?.le)
    if (robob.length > 1) {
      prevBlock = robob.at(-1)
    }

    lastBlockPos = prevBlock?.endBlockPos

    // Update the previous heading start position if the previous block is at depth 2
    if (prevBlock && prevBlock.depth === 2) {
      prevHStartPos = prevBlock.startBlockPos
    }

    // Insert the heading at the appropriate position
    tr.insert(lastBlockPos - (shouldNested ? 2 : 0), heading)

    // Update the position of the last H1 heading inserted
    if (comingLevel === 1) {
      lastH1Inserted.startBlockPos = lastBlockPos
      lastH1Inserted.endBlockPos = tr.mapping.map(lastBlockPos + heading.content.size)
    }
  })

  return { lastBlockPos, prevHStartPos }
}

// Main function to handle pasting clipboard content
const clipboardPaste = (slice, editor) => {
  const { state, view } = editor
  const { doc, tr } = state
  let { selection } = state
  let { from, to, $to, $from } = selection

  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)

  if ($from.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    //TODO: handle this case later
    console.error('[Heading] Selection starts within a content heading. Cannot transform.')
    return slice.content.content.length === 1 ? slice : Slice.empty
  }

  // Get the slice of content within the selection range
  const contentWrapper = getSelectionRangeSlice(tr.doc, state, from, titleEndPos)
  const clipboardContentJson = slice.toJSON().content

  // Extract paragraphs and headings from the clipboard content
  const [paragraphs, headings] = extractParagraphsAndHeadings(clipboardContentJson, state)

  // If there are no headings to paste, return the original slice
  if (headings.length === 0) return slice

  // Delete the current content in the selection range
  tr.delete(to, titleEndPos)

  // If there are paragraphs, replace the current selection with the paragraphs
  if (paragraphs.length !== 0) {
    tr.replaceWith(tr.mapping.map(from), tr.mapping.map(from), paragraphs)
    const newSelection = new TextSelection(tr.doc.resolve(selection.from))
    tr.setSelection(newSelection)
  }

  // Determine the last block position after inserting paragraphs
  let lastBlockPos = paragraphs.length === 0 ? from : tr.mapping.map(from)

  // Filter out heading content from the contentWrapper
  const headingContent = contentWrapper
    .filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)
    .map((x) => createNodeFromJSON(x, state.schema))

  // Initialize the position of the last H1 heading inserted
  let lastH1Inserted = {
    startBlockPos: tr.mapping.map(titleStartPos),
    endBlockPos: tr.mapping.map(titleEndPos)
  }

  let { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, from)

  try {
    // Insert headings into the transaction
    const insertionResult = insertHeadings(
      tr,
      headings,
      lastBlockPos,
      lastH1Inserted,
      from,
      titleStartPos,
      prevHStartPos
    )

    lastBlockPos = insertionResult.lastBlockPos
    prevHStartPos = insertionResult.prevHStartPos

    // If there is remaining content in the contentWrapper, insert it after the last heading
    if (contentWrapper.length) {
      const contentWrapperParagraphs = contentWrapper
        .filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
        .map((paragraph) => createNodeFromJSON(paragraph, state.schema))

      if (contentWrapperParagraphs.length > 0) {
        tr.insert(lastBlockPos + headings.at(-1).content.size - 2, contentWrapperParagraphs)
      }
    }

    // Insert the filtered heading content into the transaction
    insertHeadings(
      tr,
      headingContent,
      lastBlockPos,
      lastH1Inserted,
      from,
      titleStartPos,
      prevHStartPos
    )

    tr.setMeta('paste', true)
    view.dispatch(tr)
    return Slice.empty
  } catch (error) {
    // Log the error if any occurs during the paste operation and return an empty slice
    console.error('[heading][clipboardPaste]:', error)
    return Slice.empty
  }
}

export default clipboardPaste
