import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// Prefer library types from @tiptap/core and @tiptap/pm/* over anything declared here.

/** PubSub topics for editor events crossing component boundaries. */
export const TIPTAP_EVENTS = {
  NEW_HEADING_CREATED: 'newHeadingCreated'
} as const

/** Transaction meta keys that mark a transaction for special handling. */
export const TRANSACTION_META = {
  RENDER_TOC: 'renderTOC',
  PASTE: 'paste',
  ADD_TO_HISTORY: 'addToHistory',
  COPY_TO_DOC: 'copyToDoc',
  NEW_HEADING_CREATED: 'newHeadingCreated',
  HEADING_DELETED: 'headingDeleted',
  HEADING_TEXT_CHANGED: 'headingTextChanged'
} as const

export const TIPTAP_NODES = {
  DOC_TYPE: 'doc',
  HEADING_TYPE: 'heading',
  PARAGRAPH_TYPE: 'paragraph',
  HYPERLINK_TYPE: 'hyperlink',
  TEXT_TYPE: 'text',
  BULLETLIST_TYPE: 'bulletList',
  ORDEREDLIST_TYPE: 'orderedList',
  LISTITEM_TYPE: 'listItem',
  HARD_BREAK_TYPE: 'hardBreak',
  MEDIA_UPLOAD_PLACEHOLDER_TYPE: 'mediaUploadPlaceholder',
  BLOCKQUOTE_TYPE: 'blockquote',
  CODE_BLOCK_TYPE: 'codeBlock',
  IMAGE_TYPE: 'image',
  TABLE_TYPE: 'table',
  TASK_LIST_TYPE: 'taskList',
  TASK_ITEM_TYPE: 'taskItem',
  HORIZONTAL_RULE_TYPE: 'horizontalRule'
} as const

export const HTML_ENTITIES = {
  NBSP: '\u00A0',
  LT: '\u003C',
  GT: '\u003E',
  AMP: '\u0026',
  QUOT: '\u0022',
  APOSTROPHE: '\u0027'
} as const

export const TIPTAP_ENUMS = {
  EVENTS: TIPTAP_EVENTS,
  NODES: TIPTAP_NODES,
  HTML_ENTITIES,
  TRANSACTION_META
} as const

/** @deprecated Use named exports TIPTAP_EVENTS, TIPTAP_NODES, HTML_ENTITIES instead */
export default TIPTAP_ENUMS

export type TipTapEventType = (typeof TIPTAP_EVENTS)[keyof typeof TIPTAP_EVENTS]
export type TipTapNodeType = (typeof TIPTAP_NODES)[keyof typeof TIPTAP_NODES]
export type HtmlEntityType = (typeof HTML_ENTITIES)[keyof typeof HTML_ENTITIES]
export type TransactionMetaKey = (typeof TRANSACTION_META)[keyof typeof TRANSACTION_META]

// Command augmentations removed — flat schema uses standard toggleHeading/setParagraph from StarterKit

/** Loose on purpose for custom commands; new code should import Editor from '@tiptap/core'. */
export type TipTapEditor = any

// Re-exported so '@types' stays the single import site for these.
export type { CommandProps, Editor } from '@tiptap/core'
export type {
  DOMOutputSpec,
  Mark,
  NodeType,
  Node as ProseMirrorNode,
  ResolvedPos,
  Schema
} from '@tiptap/pm/model'
export type { EditorState, Selection, Transaction } from '@tiptap/pm/state'
export type { EditorView, ViewMutationRecord } from '@tiptap/pm/view'

export interface NodePosition {
  from: number
  to: number
  nodeSize: number
  childCount: number
}

/** Payload for the PubSub topics in TIPTAP_EVENTS. */
export interface EditorEventData {
  headingId?: string | null
  open?: boolean
  [key: string]: any
}

// For decoration building, use ProseMirror types directly: DecorationSet from
// '@tiptap/pm/view', Transaction from '@tiptap/pm/state', Node from '@tiptap/pm/model'.

export interface HeadingNodeData extends NodePosition {
  headingId: string
  level: number
  node: ProseMirrorNode
}

// Plugin configurations import their types directly from TipTap/ProseMirror.

// HeadingToggleEvent and FoldClickEventData removed — fold is now plugin-driven via HeadingFold
