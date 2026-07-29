import type { ChatPaneMode } from '@types'

/** Body copy the document always keeps, so its last section stays reachable. */
export const CHAT_PANE_DOC_FLOOR_PX = 96

/**
 * The pane's non-shrinkable furniture: grabber 44 + header 45 + feed padding 20 +
 * composer 61 = 170, rounded up to 176 because only the grabber's 44 is pinned by a
 * class — the rest is emergent from padding and content, so it can drift upward. The
 * feed is `flex-1 min-h-0`, but its own padding does not shrink, so a smaller floor
 * pushes the composer below the viewport.
 */
export const CHAT_PANE_FLOOR_PX = 176

const MODE_RATIO: Record<ChatPaneMode, number> = { closed: 0, half: 0.5, expanded: 1 }

/**
 * One clamp for every mode. The upper bound keeps the document from collapsing;
 * `Math.max` resolves a shell too short for both floors by letting the pane keep
 * enough height to type in. `reservedHeight` is measured, not assumed, so nothing
 * here has to track the pad header's rendered size.
 */
export const resolveChatPaneHeight = ({
  shellHeight,
  reservedHeight,
  mode
}: {
  shellHeight: number
  reservedHeight: number
  mode: ChatPaneMode
}): number => {
  if (mode === 'closed' || shellHeight <= 0) return 0

  const wanted = Math.round(shellHeight * MODE_RATIO[mode])
  const upper = Math.max(CHAT_PANE_FLOOR_PX, shellHeight - reservedHeight - CHAT_PANE_DOC_FLOOR_PX)

  return Math.min(Math.max(wanted, CHAT_PANE_FLOOR_PX), upper)
}
