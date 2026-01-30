import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * TipTap Editor Types & Constants
 *
 * This file contains all TypeScript definitions for TipTap editor functionality,
 * including ProseMirror decorations, plugins, editor-specific types, and constants.
 *
 * Note: Use library types from @tiptap/core and @tiptap/pm/* where possible.
 */

// ============================================================================
// Editor Constants & Enums
// ============================================================================

/**
 * TipTap editor events
 * Used for PubSub communication between components
 */
export const TIPTAP_EVENTS = {
  /** Fold/unfold heading section (crinkle) */
  FOLD_AND_UNFOLD: 'foldAndUnfold',
  /** New heading was created */
  NEW_HEADING_CREATED: 'newHeadingCreated'
} as const

/**
 * Transaction metadata keys
 * Used to mark transactions for specific handling (e.g., TOC updates)
 */
export const TRANSACTION_META = {
  /** Fold/unfold event occurred - triggers TOC update */
  FOLD_AND_UNFOLD: 'foldAndUnfold',
  /** Request to render/rebuild TOC */
  RENDER_TOC: 'renderTOC',
  /** Content was pasted */
  PASTE: 'paste',
  /** New heading was created */
  NEW_HEADING_CREATED: 'newHeadingCreated',
  /** Heading level changed */
  HEADING_LEVEL_CHANGED: 'headingLevelChanged',
  /** Heading was deleted */
  HEADING_DELETED: 'headingDeleted',
  /** Heading text changed */
  HEADING_TEXT_CHANGED: 'headingTextChanged',
  /** Skip history for this transaction */
  ADD_TO_HISTORY: 'addToHistory',
  /** Content copied to document from chat */
  COPY_TO_DOC: 'copyToDoc'
} as const

/**
 * TipTap node type constants
 */
export const TIPTAP_NODES = {
  DOC_TYPE: 'doc',
  HEADING_TYPE: 'heading',
  CONTENT_HEADING_TYPE: 'contentHeading',
  CONTENT_WRAPPER_TYPE: 'contentWrapper',
  PARAGRAPH_TYPE: 'paragraph',
  HYPERLINK_TYPE: 'hyperlink',
  TEXT_TYPE: 'text',
  BULLETLIST_TYPE: 'bulletList',
  ORDEREDLIST_TYPE: 'orderedList',
  LISTITEM_TYPE: 'listItem',
  HARD_BREAK_TYPE: 'hardBreak',
  MEDIA_UPLOAD_PLACEHOLDER_TYPE: 'mediaUploadPlaceholder'
} as const

/**
 * HTML entity constants
 */
export const HTML_ENTITIES = {
  NBSP: '\u00A0', // Unicode for non-breaking space
  LT: '\u003C', // Unicode for less-than symbol
  GT: '\u003E', // Unicode for greater-than symbol
  AMP: '\u0026', // Unicode for ampersand
  QUOT: '\u0022', // Unicode for double quote
  APOSTROPHE: '\u0027' // Unicode for apostrophe
} as const

/**
 * Combined TipTap constants (backwards compatibility)
 */
export const TIPTAP_ENUMS = {
  EVENTS: TIPTAP_EVENTS,
  NODES: TIPTAP_NODES,
  HTML_ENTITIES,
  TRANSACTION_META
} as const

/**
 * Legacy export for backwards compatibility with existing code
 * @deprecated Use named exports TIPTAP_EVENTS, TIPTAP_NODES, HTML_ENTITIES instead
 */
export default TIPTAP_ENUMS

/**
 * Type definitions for the constants
 */
export type TipTapEventType = (typeof TIPTAP_EVENTS)[keyof typeof TIPTAP_EVENTS]
export type TipTapNodeType = (typeof TIPTAP_NODES)[keyof typeof TIPTAP_NODES]
export type HtmlEntityType = (typeof HTML_ENTITIES)[keyof typeof HTML_ENTITIES]
export type TransactionMetaKey = (typeof TRANSACTION_META)[keyof typeof TRANSACTION_META]

// ============================================================================
// Core Editor Types (Re-exports from TipTap/ProseMirror)
// ============================================================================

/**
 * TipTap editor instance type
 * Using 'any' for flexibility with custom commands.
 * For strict typing in new code, import Editor directly from '@tiptap/core'
 */

export type TipTapEditor = any

/**
 * Re-export commonly used ProseMirror/TipTap types for convenience.
 * Import from '@types' to maintain single source of truth.
 */
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

/**
 * Editor node position information
 */
export interface NodePosition {
  from: number
  to: number
  nodeSize: number
  childCount: number
}

/**
 * Editor event data for PubSub communication
 */
export interface EditorEventData {
  headingId?: string | null
  open?: boolean
  [key: string]: any
}

// ============================================================================
// Decoration System Types
// ============================================================================

// Note: For decoration building, use ProseMirror types directly:
// - DecorationSet from '@tiptap/pm/view'
// - Transaction from '@tiptap/pm/state'
// - Node from '@tiptap/pm/model'

// ============================================================================
// Content Structure Types
// ============================================================================

/**
 * Content wrapper block data structure
 */
export interface ContentWrapperBlock extends NodePosition {
  headingId: string | null
}

/**
 * Heading node data structure
 */
export interface HeadingNodeData extends NodePosition {
  headingId: string
  level: number
  node: ProseMirrorNode
}

// ============================================================================
// Plugin Configuration Types
// ============================================================================

// Note: Plugin configurations should import types directly from TipTap/ProseMirror
// - Use Editor from '@tiptap/core'
// - Use Node, DecorationSet from '@tiptap/pm/*'

// ============================================================================
// DOM Event Types
// ============================================================================

/**
 * Custom DOM event for heading section toggle
 */
export interface HeadingToggleEvent extends CustomEvent {
  detail: {
    headingId: string
    el: HTMLElement
  }
}

/**
 * Fold wrapper click event data
 */
export interface FoldClickEventData {
  headingId: string | null
  open: boolean
}
