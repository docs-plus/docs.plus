import { Slice, Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  TIPTAP_NODES,
  TRANSACTION_META,
  type EditorState,
  type Transaction,
  type Editor,
  type ProseMirrorNode
} from '@types'
import {
  getSelectionRangeSlice,
  getPrevHeadingPos,
  linearizeHeadingNodes,
  transformClipboardToStructured,
  insertHeadingsByNodeBlocks,
  adjustHeadingLevelsForContext,
  getPasteContextLevel
} from './helper'

/**
 * Removes empty nodes from both the beginning and end of a content array
 *
 * Iteratively removes nodes that have no content from the start and end of the array
 * until it encounters nodes with actual content. This helps clean up clipboard content
 * by removing unnecessary empty paragraphs that could interfere with paste operations.
 */
const trimEmptyNodes = (contentArray: any[]): any[] => {
  // Remove empty nodes from the beginning
  while (contentArray.length > 0 && !contentArray[0].content?.length) {
    contentArray.shift()
  }

  // Remove empty nodes from the end
  while (contentArray.length > 0 && !contentArray[contentArray.length - 1].content?.length) {
    contentArray.pop()
  }

  return contentArray
}

/**
 * Inserts paragraphs at the current position and maintains cursor position
 *
 * Creates a proper slice from paragraph nodes and uses replaceRange to
 * insert them at the specified position, allowing for proper content merging.
 * The cursor position is preserved after insertion.
 */
const insertParagraphsAtPosition = (
  tr: Transaction,
  paragraphs: ProseMirrorNode[],
  state: EditorState,
  from: number
): void => {
  if (paragraphs.length === 0) return

  // Create content array, ensuring TextNodes are properly wrapped
  const contentArray = [...paragraphs]
    .map((node) => {
      // If it's a TextNode, wrap it in a paragraph
      if (node.type.name === TIPTAP_NODES.TEXT_TYPE) {
        return state.schema.nodes.paragraph.create(null, [node])
      }
      return node
    })
    .map((p) => p.toJSON())

  // Create a proper slice from the paragraphs
  const fragment = state.schema.nodeFromJSON({
    type: 'doc',
    content: contentArray
  }).content

  const slice = new Slice(fragment, 1, 1) // openStart=1, openEnd=1 to allow merging

  // Use replaceRange instead of insert to properly merge content
  tr.replaceRange(from, from, slice)

  // Update selection, and make sure the caret doesn't move
  const newSelection = TextSelection.create(tr.doc, from)
  tr.setSelection(newSelection)
}

// Main function to handle pasting clipboard content
const clipboardPaste = (slice: Slice, editor: Editor): Slice => {
  const { state, view } = editor
  const { tr } = state
  let { selection } = state
  let { from, to, $to, $from } = selection

  let titleStartPos = $from.start(1) - 1
  let titleEndPos = $to.end(1)

  // Handle paste when cursor is inside a contentheading node
  if (
    $from.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE &&
    slice.content.childCount > 0
  ) {
    const firstNode = slice.content.child(0)

    // Insert text or content at cursor position
    if (firstNode.content?.childCount) {
      const contentNodes: ProseMirrorNode[] = []
      firstNode.content.forEach((child) => contentNodes.push(child))
      tr.insert(from, contentNodes)
    } else if (firstNode.isText && firstNode.text) {
      tr.insertText(firstNode.text, from)
    }

    // If there are multiple nodes in the slice, handle remaining content
    if (slice.content.childCount > 1) {
      const shiftedNodeSize = slice.content.child(0).content?.size || 0

      // Create new slice with remaining content by removing the first child
      const remainingContent: ProseMirrorNode[] = []
      slice.content.forEach((node, offset, index) => {
        if (index > 0) remainingContent.push(node)
      })
      slice = new Slice(Fragment.from(remainingContent), slice.openStart, slice.openEnd)

      // Move cursor to appropriate position for remaining content
      const contentWrapperPos = $from.after() + shiftedNodeSize
      selection = TextSelection.create(tr.doc, contentWrapperPos)
      tr.setSelection(selection)

      // Update selection variables
      from = selection.from
      to = selection.to
      $from = selection.$from
      $to = selection.$to
      titleStartPos = $from.start(1) - 1
      titleEndPos = $to.end(1)
    } else {
      // Only one node to paste, we're done
      view.dispatch(tr)
      return Slice.empty
    }
  }

  const contentWrapper = getSelectionRangeSlice(tr.doc, state, to, titleEndPos)
  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  // Normalize the slice content by removing empty nodes from both ends
  const sliceJsonContent = trimEmptyNodes([...slice.toJSON().content])

  const linearizedHeadings = linearizeHeadingNodes(contentWrapperHeadings as any)

  const aggregatedContent = [
    ...sliceJsonContent,
    ...contentWrapperParagraphs,
    ...linearizedHeadings.map((node) => {
      // Handle both ProseMirror nodes (with .toJSON) and plain objects
      return typeof node.toJSON === 'function' ? node.toJSON() : node
    })
  ]

  // Extract paragraphs and headings from the clipboard content
  const [paragraphs, rawHeadings] = transformClipboardToStructured(aggregatedContent, state)

  // If there are no headings to paste, return the original slice - simple content handled by contentWrapper
  if (rawHeadings.length === 0) {
    tr.setMeta(TRANSACTION_META.PASTE, true)
    view.dispatch(tr)
    return slice
  }

  // Get the paste context level to adjust heading levels appropriately
  // HN-10: Child level must be > parent level
  const contextLevel = getPasteContextLevel(tr.doc, from)

  // Convert headings to JSON for level adjustment
  const headingsJson = rawHeadings.map((h) => h.toJSON())

  // Adjust heading levels to fit the paste context
  const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(
    headingsJson,
    contextLevel,
    state.schema
  )

  // Delete all content from the caret to the end of the document
  tr.delete(from, titleEndPos)

  if (paragraphs.length !== 0) {
    insertParagraphsAtPosition(tr, paragraphs, state, from)
  }

  let lastBlockPos = paragraphs.length === 0 ? from : tr.mapping.map(from)

  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, lastBlockPos)

  // Initialize the position of the last H1 heading inserted
  let lastH1Inserted = {
    startBlockPos: Math.min(tr.mapping.map(titleStartPos), tr.doc.content.size),
    endBlockPos: Math.min(tr.mapping.map(titleEndPos), tr.doc.content.size)
  }

  try {
    // Insert adjusted headings at their appropriate positions
    if (adjustedHeadings.length > 0) {
      insertHeadingsByNodeBlocks(
        tr,
        adjustedHeadings,
        lastBlockPos,
        lastH1Inserted,
        from,
        titleStartPos,
        prevHStartPos
      )
    }

    // Insert H1 headings at document root (they become new sections)
    if (h1Headings.length > 0) {
      const docEnd = tr.doc.content.size
      for (const h1 of h1Headings) {
        tr.insert(docEnd, h1)
      }
    }
  } catch (error) {
    console.error('[heading][clipboardPaste]:', error)
    return Slice.empty
  }

  // insert hello world to the end of the lastH1inserte
  tr.setMeta(TRANSACTION_META.PASTE, true)
  view.dispatch(tr)
  return Slice.empty
}

export default clipboardPaste
