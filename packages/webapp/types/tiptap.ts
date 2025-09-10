import { Transaction, EditorState } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DecorationSet } from '@tiptap/pm/view'
import { Plugin } from '@tiptap/pm/state'

/**
 * TipTap Editor Types & Constants
 *
 * This file contains all TypeScript definitions for TipTap editor functionality,
 * including ProseMirror decorations, plugins, editor-specific types, and constants.
 */

// ============================================================================
// Editor Constants & Enums
// ============================================================================

/**
 * TipTap editor events
 */
export const TIPTAP_EVENTS = {
  FOLD_AND_UNFOLD: 'foldAndUnfold',
  NEW_HEADING_CREATED: 'newHeadingCreated'
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
  LISTITEM_TYPE: 'listItem'
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
  HTML_ENTITIES
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

// ============================================================================
// Core Editor Types
// ============================================================================

/**
 * TipTap editor instance type
 * @description Using any for flexibility since TipTap has complex internal types
 */
export type TipTapEditor = any

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

/**
 * Function type for building decorations from a document
 */
export type BuildDecorationsFunction = (doc: ProseMirrorNode) => DecorationSet

/**
 * Plugin state apply function type for decoration optimization
 */
export type PluginStateApplyFunction = (tr: Transaction, old: DecorationSet) => DecorationSet

/**
 * Decoration plugin state configuration
 */
export interface DecorationPluginState {
  init: (config: any, state: { doc: ProseMirrorNode }) => DecorationSet
  apply: PluginStateApplyFunction
}

/**
 * Decoration plugin props configuration
 */
export interface DecorationPluginProps {
  decorations: (state: EditorState) => DecorationSet
}

/**
 * Plugin factory function type
 */
export type PluginFactory = () => Plugin

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
// Plugin-Specific Function Types
// ============================================================================

/**
 * Function type for creating button decorations on headings
 */
export type CreateButtonDecorationsFunction = (
  doc: ProseMirrorNode,
  editor: TipTapEditor
) => DecorationSet

/**
 * Function type for creating title-specific button decorations
 */
export type CreateTitleButtonDecorationsFunction = (
  doc: ProseMirrorNode,
  editor: TipTapEditor
) => DecorationSet

/**
 * Function type for creating content wrapper fold decorations
 */
export type CreateFoldDecorationsFunction = (doc: ProseMirrorNode) => DecorationSet

// ============================================================================
// Plugin Configuration Types
// ============================================================================

/**
 * Configuration for heading buttons plugin
 */
export interface HeadingButtonsPluginConfig {
  appendButtonsDec: CreateButtonDecorationsFunction
  editor: TipTapEditor
}

/**
 * Configuration for title buttons plugin
 */
export interface TitleButtonsPluginConfig {
  createTitleButtonDecorations: CreateTitleButtonDecorationsFunction
  editor: TipTapEditor
}

/**
 * Configuration for crinkle/fold plugin
 */
export interface CrinklePluginConfig {
  targetNodeTypes: string[]
  buildDecorations: CreateFoldDecorationsFunction
}

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
