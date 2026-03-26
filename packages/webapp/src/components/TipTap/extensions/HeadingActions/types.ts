/**
 * Configuration options for the HeadingActions extension
 */
export interface HeadingActionsOptions {
  hoverChat: boolean
  selectionChat: boolean
}

/**
 * CSS class names for heading-action widgets (ProseMirror decorations).
 * Prefix `ha-` = heading actions; keep in sync with `_heading-actions.scss`.
 */
export const HEADING_ACTIONS_CLASSES = {
  wrap: 'ha-wrap',
  group: 'ha-group',
  /** Collapsed mode: single chat trigger */
  single: 'ha-single',
  /** Opens heading chat (same control in collapsed + expanded group) */
  chatBtn: 'ha-chat-btn',
  /** Adds a comment for the current selection */
  commentBtn: 'ha-comment-btn',
  hasSelection: 'has-selection'
} as const

export type HeadingActionsClassName =
  (typeof HEADING_ACTIONS_CLASSES)[keyof typeof HEADING_ACTIONS_CLASSES]

export interface HeadingNodeData {
  to: number
  headingId: string | null
}
