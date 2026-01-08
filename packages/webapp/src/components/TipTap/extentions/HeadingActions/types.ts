/**
 * Configuration options for the HeadingActions extension
 */
export interface HeadingActionsOptions {
  hoverChat: boolean
  selectionChat: boolean
  headingToggle: boolean
}

/** CSS classes for HeadingActions components */
export const HEADING_ACTIONS_CLASSES = {
  hoverWrapper: 'ha-wrap',
  hoverChatBtn: 'ha-chat-btn',
  selectionChatBtn: 'ha-comment-btn',
  hoverGroup: 'ha-group',
  hasSelection: 'has-selection'
} as const

/** Union of all HeadingActions class name values */
export type HAClassName = (typeof HEADING_ACTIONS_CLASSES)[keyof typeof HEADING_ACTIONS_CLASSES]

/** Data for a heading node position */
export interface HeadingNodeData {
  to: number
  headingId: string | null
}
