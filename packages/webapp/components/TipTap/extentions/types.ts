import { Editor } from '@tiptap/core'
import { Transaction, EditorState } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorView } from '@tiptap/pm/view'

// ============================================================================
// Command Types
// ============================================================================

export interface CommandArgs {
  state: EditorState
  tr: Transaction
  dispatch?: (tr: Transaction) => void
  view?: EditorView
  editor: Editor
}

export interface HeadingAttributes {
  level: number
  id?: string | null
}

// ============================================================================
// Helper Function Types
// ============================================================================

export interface HeadingBlockInfo {
  le: number
  depth: number
  startBlockPos: number
  endBlockPos: number
  endContentPos?: number
  index?: number
  node?: any
}

export interface SelectionBlock {
  depth: number
  startBlockPos: number
  endBlockPos: number
  type: string
  content?: any[]
  attrs?: any
  level?: number
  le?: number
  node?: ProseMirrorNode
}

export interface BlockMap {
  parent: { start: number; end: number }
  edge: { start: number; end: number }
  ancesster: { start: number; end: number }
  start: number
  end: number
  depth: number
  nextLevel: number
  headingContent: { type: string; text: string }
  empty: { type: string }
  paragraph: { type: string }
}

export interface PrevBlockResult {
  prevBlock: HeadingBlockInfo | null
  shouldNested: boolean
}

export interface NodeState {
  headingId?: string
  crinkleOpen: boolean
}

export interface HeadingPosition {
  prevHStartPos: number
  prevHEndPos: number
}

export interface InsertHeadingsParams {
  state: EditorState
  tr: Transaction
  headings: any[]
  titleStartPos: number
  titleEndPos: number
  prevHStartPos: number
}

export interface LastH1Inserted {
  startBlockPos: number
  endBlockPos: number
}

export interface InsertHeadingsByNodeBlocksResult {
  lastBlockPos: number
  prevHStartPos: number
}

// ============================================================================
// Normal Text Extension Types
// ============================================================================

export interface NormalTextArgs {
  editor: Editor
  state: EditorState
  tr: Transaction
  view: EditorView
  backspaceAction?: boolean
}
