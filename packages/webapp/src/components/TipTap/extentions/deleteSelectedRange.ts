import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { EditorState, Transaction } from '@tiptap/pm/state'
import { HTML_ENTITIES, TIPTAP_NODES } from '@types'

import { getSelectionRangeBlocks, getSelectionRangeSlice, insertRemainingHeadings } from './helper'
import { SelectionBlock } from './types'

interface HandleHeadingBlockParams {
  tr: Transaction
  state: EditorState
  selectedContents: SelectionBlock[]
  titleEndPos: number
  paragraphs: SelectionBlock[]
}

interface HandleNonHeadingBlockParams {
  tr: Transaction
  state: EditorState
  selectedContents: SelectionBlock[]
  titleEndPos: number
  newContent: ProseMirrorNode[]
  paragraphs: SelectionBlock[]
}

const handleHeadingBlock = ({
  tr,
  state,
  selectedContents,
  titleEndPos,
  paragraphs
}: HandleHeadingBlockParams): void => {
  const { $from, $to } = state.selection
  const blockRange = $from.blockRange($to)

  const selectedFirstBlockPos = selectedContents.at(0)!.startBlockPos

  tr.deleteRange(selectedFirstBlockPos - 1, titleEndPos)

  const attrLevel = blockRange!.parent.attrs.level || blockRange!.$from.parent.attrs.level

  let jsonNode = {
    type: TIPTAP_NODES.HEADING_TYPE,
    attrs: {
      level: attrLevel
    },
    content: [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        content: [
          blockRange!.$from?.nodeBefore?.toJSON() || {
            type: TIPTAP_NODES.TEXT_TYPE,
            text: HTML_ENTITIES.NBSP
          }
        ],
        attrs: {
          level: attrLevel
        }
      },
      {
        type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
        content: [...paragraphs]
      }
    ]
  }

  const insertPos = selectedFirstBlockPos - 1

  const editorNode = state.schema.nodeFromJSON(jsonNode)
  tr.insert(insertPos, editorNode)
}

const handleNonHeadingBlock = ({
  tr,
  state,
  selectedContents,
  titleEndPos,
  newContent,
  paragraphs
}: HandleNonHeadingBlockParams): void => {
  const { $from, $to, from, to } = state.selection
  const blockRange = $from.blockRange($to)

  tr.deleteRange(selectedContents.at(0)!.startBlockPos, titleEndPos)
  tr.insert(selectedContents.at(0)!.startBlockPos, newContent)

  tr.delete(from, tr.mapping.map(to))
  if (blockRange?.$to?.nodeBefore) {
    // trick to match the insert postion
    const emptyTextJson = {
      type: TIPTAP_NODES.TEXT_TYPE,
      text: HTML_ENTITIES.NBSP.repeat(blockRange?.$to?.nodeAfter?.nodeSize || 1)
    }
    const emptyTextNode = state.schema.nodeFromJSON(emptyTextJson)
    tr.insert(from, emptyTextNode)
  }

  tr.insert(
    from,
    paragraphs.map((node) => state.schema.nodeFromJSON(node))
  )
}

const deleteSelectedRange = (editor: Editor): boolean => {
  const { state } = editor
  const { selection, doc, tr } = state
  const { $from, $to, from, to, $anchor, $head } = selection
  const docSize = doc.content.size

  // if the selection is the whole document, then let default behavior
  if (docSize === $to.pos && $from.pos === 0) return false

  const blockRange = $from.blockRange($to)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = $to.end(1)
  const fromOffset = from - ($anchor?.textOffset || 0)
  const toOffset = to - ($head?.textOffset || 0)

  if (doc.resolve(to).parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    // TODO: handle this case later
    // throw new Error('Selection starts within a content heading')
    console.error(
      '[delete Selected Range]: Selection starts within a content heading, not handdle '
    )
    return true
  }
  try {
    const titleSelectionRange = getSelectionRangeSlice(doc, state, to, titleEndPos)
    const selectedContents = getSelectionRangeBlocks(doc, fromOffset, toOffset)
    const restSelectionContents = getSelectionRangeSlice(doc, state, to, titleEndPos)

    const paragraphs = restSelectionContents.filter(
      (node) => node.type !== TIPTAP_NODES.HEADING_TYPE
    )
    const headings = titleSelectionRange.filter((node) => node.type === TIPTAP_NODES.HEADING_TYPE)

    // If only one block is selected, retain default behavior
    if (selectedContents.length === 1) return false

    const selectedNodes = selectedContents.map((node) => state.schema.nodeFromJSON(node))
    const paragraphNodes = paragraphs.map((node) => {
      return state.schema.nodeFromJSON(node)
    })

    const newContent = [...selectedNodes, ...paragraphNodes]

    if (blockRange!.$from.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      handleHeadingBlock({ tr, state, titleEndPos, selectedContents, paragraphs })
    } else {
      handleNonHeadingBlock({ tr, state, titleEndPos, selectedContents, newContent, paragraphs })
    }

    insertRemainingHeadings({
      state,
      tr,
      headings,
      titleStartPos,
      titleEndPos: tr.mapping.map(titleEndPos),
      prevHStartPos: titleStartPos
    })

    const focusSelection = new TextSelection(tr.doc.resolve(from))
    tr.setSelection(focusSelection)

    if (tr && editor.view?.dispatch) editor.view?.dispatch(tr)
    return false
  } catch (error) {
    console.error('[heading][deleteSelectedRange] error', error)
    return false
  }
}

export default deleteSelectedRange
