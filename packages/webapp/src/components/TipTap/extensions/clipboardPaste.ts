import { Fragment, Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  type Editor,
  type EditorState,
  type ProseMirrorNode,
  TIPTAP_NODES,
  type Transaction,
  TRANSACTION_META
} from '@types'
import { logger } from '@utils/logger'

import {
  adjustHeadingLevelsForContext,
  asJsonNodeArray,
  buildHeadingTree,
  getPasteContextLevel,
  getPrevHeadingPos,
  getSelectionRangeSlice,
  insertHeadingsByNodeBlocks,
  isProseMirrorNode,
  linearizeHeadingNodes,
  transformClipboardToStructured
} from './helper'
import { findRootH1EndPos } from './helper/selection'
import { JSONNode } from './types'

/**
 * Removes empty nodes from both the beginning and end of a content array
 *
 * Iteratively removes nodes that have no content from the start and end of the array
 * until it encounters nodes with actual content. This helps clean up clipboard content
 * by removing unnecessary empty paragraphs that could interfere with paste operations.
 */
const trimEmptyNodes = (contentArray: JSONNode[]): JSONNode[] => {
  let start = 0
  let end = contentArray.length

  while (start < end && !contentArray[start].content?.length) start++
  while (end > start && !contentArray[end - 1].content?.length) end--

  return contentArray.slice(start, end)
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

  const blockNodes = paragraphs.map((node) =>
    node.type.name === TIPTAP_NODES.TEXT_TYPE
      ? state.schema.nodes.paragraph.create(null, [node])
      : node
  )

  const fragment = Fragment.fromArray(blockNodes)
  const slice = new Slice(fragment, 1, 1)

  tr.replaceRange(from, from, slice)
  tr.setSelection(TextSelection.create(tr.doc, from))
}

const BLOCK_NODE_TYPES: Set<string> = new Set([
  TIPTAP_NODES.PARAGRAPH_TYPE,
  TIPTAP_NODES.HEADING_TYPE,
  TIPTAP_NODES.CONTENT_HEADING_TYPE,
  TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
  TIPTAP_NODES.BULLETLIST_TYPE,
  TIPTAP_NODES.ORDEREDLIST_TYPE,
  TIPTAP_NODES.LISTITEM_TYPE,
  TIPTAP_NODES.BLOCKQUOTE_TYPE,
  TIPTAP_NODES.CODE_BLOCK_TYPE,
  TIPTAP_NODES.IMAGE_TYPE,
  TIPTAP_NODES.TABLE_TYPE,
  TIPTAP_NODES.TASK_LIST_TYPE,
  TIPTAP_NODES.TASK_ITEM_TYPE,
  TIPTAP_NODES.HORIZONTAL_RULE_TYPE
])

/**
 * Wraps any inline/text JSON nodes in paragraph nodes so they're valid
 * inside a contentWrapper (which requires block-level content).
 * Consecutive inline nodes are merged into a single paragraph.
 */
const ensureBlockNodes = (nodes: JSONNode[]): JSONNode[] => {
  const result: JSONNode[] = []
  let pendingInline: JSONNode[] = []

  const flushInline = () => {
    if (pendingInline.length === 0) return
    result.push({
      type: TIPTAP_NODES.PARAGRAPH_TYPE,
      content: pendingInline
    })
    pendingInline = []
  }

  for (const node of nodes) {
    if (BLOCK_NODE_TYPES.has(node.type)) {
      flushInline()
      result.push(node)
    } else {
      pendingInline.push(node)
    }
  }

  flushInline()
  return result
}

/**
 * Recursively ensures all contentWrapper nodes in a heading tree have
 * only block-level children (wraps stray inline/text in paragraphs).
 */
const sanitizeContentWrappers = (nodes: JSONNode[]): void => {
  for (const node of nodes) {
    if (!node.content) continue
    if (node.type === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
      node.content = ensureBlockNodes(node.content)
    }
    sanitizeContentWrappers(node.content)
  }
}

/**
 * Finds the first valid cursor position in a document by locating the
 * first contentHeading node and returning pos+1 (inside its text).
 * Falls back to pos 1 if no contentHeading exists.
 */
const findFirstEditablePos = (doc: ProseMirrorNode): number => {
  let pos = 1
  doc.descendants((node, nodePos) => {
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      pos = nodePos + 1
      return false
    }
    return true
  })
  return Math.min(pos, doc.content.size)
}

/**
 * Handles full-document paste (CMD+A → CMD+V).
 *
 * When the entire document is selected, positions resolve at depth 0 where
 * our per-section logic cannot operate. This function:
 *   1. Converts the flat clipboard slice into structured heading groups
 *   2. Builds a nested HN-10 tree via STACK-ATTACH
 *   3. Replaces the entire document content
 *   4. Sets the cursor to the first editable position
 */
const handleFullDocumentPaste = (
  slice: Slice,
  state: EditorState,
  view: { dispatch: (tr: Transaction) => void }
): Slice => {
  const { tr, schema } = state

  const rawContent = asJsonNodeArray(slice.toJSON()?.content)
  const sliceJsonContent = trimEmptyNodes(ensureBlockNodes(rawContent))
  if (sliceJsonContent.length === 0) return slice

  const [paragraphs, rawHeadings] = transformClipboardToStructured(sliceJsonContent, state)

  try {
    if (rawHeadings.length === 0) {
      const paragraphsJson = paragraphs.map((p) => p.toJSON())
      const safeContent = ensureBlockNodes(paragraphsJson)
      const defaultHeading: JSONNode = {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 1 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 1 }, content: [] },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: safeContent }
        ]
      }
      const newNode = schema.nodeFromJSON(defaultHeading)
      tr.replaceWith(0, tr.doc.content.size, newNode)
      tr.setSelection(TextSelection.create(tr.doc, findFirstEditablePos(tr.doc)))
      tr.setMeta(TRANSACTION_META.PASTE, true)
      view.dispatch(tr)
      return Slice.empty
    }

    const headingsJson: JSONNode[] = rawHeadings.map((h) => h.toJSON())

    const { adjustedHeadings: adjustedNodes } = adjustHeadingLevelsForContext(
      headingsJson,
      0,
      schema
    )

    const adjustedJson: JSONNode[] = adjustedNodes.map((n) => n.toJSON())
    const nestedTree = buildHeadingTree(adjustedJson)

    if (paragraphs.length > 0 && nestedTree.length > 0) {
      const firstWrapper = nestedTree[0].content?.[1]
      if (firstWrapper) {
        const orphanJson = paragraphs.map((p) => p.toJSON())
        const safeOrphans = ensureBlockNodes(orphanJson)
        firstWrapper.content = [...safeOrphans, ...asJsonNodeArray(firstWrapper.content)]
      }
    }

    sanitizeContentWrappers(nestedTree)

    const newNodes = nestedTree.map((h) => schema.nodeFromJSON(h))
    tr.replaceWith(0, tr.doc.content.size, newNodes)

    tr.setSelection(TextSelection.create(tr.doc, findFirstEditablePos(tr.doc)))
    tr.setMeta(TRANSACTION_META.PASTE, true)
    view.dispatch(tr)
    return Slice.empty
  } catch (error) {
    logger.error(
      '[handleFullDocumentPaste] Failed to build HN-10 tree, falling back to native paste:',
      error
    )
    return slice
  }
}

const clipboardPaste = (slice: Slice, editor: Editor): Slice => {
  const { state, view } = editor
  const { tr } = state
  let { selection } = state
  let { from, to, $to, $from } = selection

  // AllSelection (CMD+A) resolves positions at depth 0 (doc level).
  // Our per-section logic requires depth >= 1. Delegate to the
  // full-document paste handler which builds a proper HN-10 tree.
  if ($from.depth < 1 || $to.depth < 1) {
    return handleFullDocumentPaste(slice, state, view)
  }

  let titleStartPos = $from.start(1) - 1
  let titleEndPos = $to.end(1)

  // Handle paste when cursor is inside a contentheading node
  if (
    $from.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE &&
    slice.content.childCount > 0
  ) {
    const firstNode = slice.content.child(0)

    if (firstNode.content?.childCount) {
      const contentNodes: ProseMirrorNode[] = []
      firstNode.content.forEach((child) => contentNodes.push(child))
      tr.insert(from, contentNodes)
    } else if (firstNode.isText && firstNode.text) {
      tr.insertText(firstNode.text, from)
    }

    if (slice.content.childCount > 1) {
      const remainingContent: ProseMirrorNode[] = []
      slice.content.forEach((node, offset, index) => {
        if (index > 0) remainingContent.push(node)
      })
      slice = new Slice(Fragment.from(remainingContent), slice.openStart, slice.openEnd)

      // Ensure the contentWrapper has at least one paragraph so the cursor
      // can land inside it (empty contentWrappers have no valid text positions,
      // causing TextSelection.create to jump back to a contentHeading).
      const cwPos = tr.mapping.map($from.after())
      const cwNode = tr.doc.nodeAt(cwPos)
      if (cwNode?.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE && cwNode.content.size === 0) {
        const emptyParagraph = state.schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
        tr.insert(cwPos + 1, emptyParagraph)
      }

      const contentWrapperPos = cwPos + 1
      selection = TextSelection.create(tr.doc, contentWrapperPos)
      tr.setSelection(selection)

      from = selection.from
      to = selection.to
      $from = selection.$from
      $to = selection.$to

      // Safety check: if cursor still resolved to a contentHeading despite our
      // paragraph insertion, fall back to letting ProseMirror handle natively.
      if ($from.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
        logger.error(
          '[clipboardPaste] cursor still in contentHeading after reposition, falling back'
        )
        return slice
      }

      titleStartPos = $from.start(1) - 1
      titleEndPos = $to.end(1)
    } else {
      try {
        view.dispatch(tr)
        return Slice.empty
      } catch (error) {
        logger.error('[clipboardPaste] dispatch failed for single-node paste:', error)
        return slice
      }
    }
  }

  const contentWrapper = getSelectionRangeSlice(tr.doc, state, to, titleEndPos)
  const contentWrapperParagraphs = contentWrapper.filter(
    (x) => x.type !== TIPTAP_NODES.HEADING_TYPE
  )
  const contentWrapperHeadings = contentWrapper.filter((x) => x.type === TIPTAP_NODES.HEADING_TYPE)

  const sliceJsonContent = trimEmptyNodes(asJsonNodeArray(slice.toJSON().content))

  const linearizedHeadings = linearizeHeadingNodes(contentWrapperHeadings)

  const aggregatedContent: JSONNode[] = [
    ...sliceJsonContent,
    ...contentWrapperParagraphs,
    ...linearizedHeadings.map((node) => {
      return isProseMirrorNode(node) ? node.toJSON() : node
    })
  ]

  const [paragraphs, rawHeadings] = transformClipboardToStructured(aggregatedContent, state)

  if (rawHeadings.length === 0) {
    if (tr.docChanged) {
      try {
        tr.setMeta(TRANSACTION_META.PASTE, true)
        view.dispatch(tr)
      } catch (error) {
        logger.error('[clipboardPaste] dispatch failed for no-heading paste:', error)
      }
    }
    return slice
  }

  // HN-10: Child level must be > parent level
  const contextLevel = getPasteContextLevel(tr.doc, from)

  const headingsJson = rawHeadings.map((h) => h.toJSON())
  sanitizeContentWrappers(headingsJson)

  const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(
    headingsJson,
    contextLevel,
    state.schema
  )

  tr.delete(from, titleEndPos)

  if (paragraphs.length !== 0) {
    insertParagraphsAtPosition(tr, paragraphs, state, from)
  }

  let lastBlockPos = paragraphs.length === 0 ? from : tr.mapping.map(from)

  const { prevHStartPos } = getPrevHeadingPos(tr.doc, titleStartPos, lastBlockPos)

  let lastH1Inserted = {
    startBlockPos: Math.min(tr.mapping.map(titleStartPos), tr.doc.content.size),
    endBlockPos: Math.min(tr.mapping.map(titleEndPos), tr.doc.content.size)
  }

  try {
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

    // Insert H1 headings as new root-level sections AFTER the root H1
    // that contains the paste target. This preserves document ordering —
    // pasting H1 inside Section A inserts it between A and B, not at doc end.
    if (h1Headings.length > 0) {
      let rootH1EndPos = findRootH1EndPos(tr.doc, tr.mapping.map(titleStartPos))
      for (const h1 of h1Headings) {
        tr.insert(rootH1EndPos, h1)
        rootH1EndPos = rootH1EndPos + h1.nodeSize
      }
    }
  } catch (error) {
    logger.error('[clipboardPaste] heading insertion failed:', error)
    return slice
  }

  try {
    tr.setMeta(TRANSACTION_META.PASTE, true)
    view.dispatch(tr)
    return Slice.empty
  } catch (error) {
    logger.error('[clipboardPaste] dispatch failed, falling back to native paste:', error)
    return slice
  }
}

export default clipboardPaste
