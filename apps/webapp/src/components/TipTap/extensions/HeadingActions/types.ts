export interface HeadingActionsOptions {
  hoverChat: boolean
  selectionChat: boolean
}

/** Prefix `ha-`; keep in sync with `_heading-actions.scss`. */
export const HEADING_ACTIONS_CLASSES = {
  wrap: 'ha-wrap',
  group: 'ha-group',
  single: 'ha-single',
  chatBtn: 'ha-chat-btn',
  commentBtn: 'ha-comment-btn',
  /** Same horizontal dock as `.ha-wrap` on headings. */
  selectionCommentDock: 'ha-selection-comment-dock',
  hasSelection: 'has-selection'
} as const

export type HeadingActionsClassName =
  (typeof HEADING_ACTIONS_CLASSES)[keyof typeof HEADING_ACTIONS_CLASSES]

export interface HeadingNodeData {
  to: number
  headingId: string | null
}
