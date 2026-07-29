export type PanelSurfaceVariant = 'popover' | 'sheet'

/**
 * Chat pane resting positions. Never "full" — the pane cannot cover the document,
 * which always keeps its floor so its last section stays reachable.
 */
export type ChatPaneMode = 'closed' | 'half' | 'expanded'
