import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorState, Transaction } from '@tiptap/pm/state'
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
  node?: ProseMirrorNode | JSONNode
}

export interface JSONMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface JSONNode {
  type: string
  attrs?: Record<string, unknown>
  content?: JSONNode[]
  marks?: JSONMark[]
  text?: string
}

export interface SelectionBlock {
  depth: number
  startBlockPos: number
  endBlockPos: number
  type: string
  content?: JSONNode[]
  attrs?: Record<string, unknown>
  text?: string
  marks?: JSONMark[]
  level?: number
  le?: number
  node?: ProseMirrorNode | JSONNode
}

export interface BlockMap {
  parent: { start: number; end: number }
  edge: { start: number; end: number }
  ancestor: { start: number; end: number }
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

export interface HeadingTraversalMetrics {
  headingWindowScans: number
  headingNodesVisited: number
  topLevelBoundaryScans: number
}

export interface InsertHeadingsParams {
  state: EditorState
  tr: Transaction
  headings: Array<SelectionBlock | JSONNode>
  titleStartPos: number
  titleEndPos: number
  prevHStartPos: number
  traversalMetrics?: HeadingTraversalMetrics
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
