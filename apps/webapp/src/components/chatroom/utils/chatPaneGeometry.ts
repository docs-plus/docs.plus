import type { ChatPaneMode } from '@types'

/** Body copy the document always keeps, so its last section stays reachable. */
export const CHAT_PANE_DOC_FLOOR_PX = 96

/**
 * 184px is measured furniture (grabber+header+feed+composer), not estimated — that's what
 * makes a regression here catchable. The bottom safe-area inset is deliberately excluded and
 * measured at runtime instead (see `resolveChatPaneHeight`'s `safeAreaInsetBottom`), so baking
 * the notched value in here would over-reserve on every other device.
 */
export const CHAT_PANE_FLOOR_PX = 184

const MODE_RATIO: Record<ChatPaneMode, number> = { closed: 0, half: 0.5, expanded: 1 }

/**
 * One clamp for every mode; `Math.max` keeps the pane usable when the shell is too short
 * for both floors. `reservedHeight` and `safeAreaInsetBottom` are both measured, not
 * assumed, so nothing here has to track the pad header's rendered size or bake in a
 * notch value that would over-reserve on other devices.
 */
export const resolveChatPaneHeight = ({
  shellHeight,
  reservedHeight,
  safeAreaInsetBottom = 0,
  mode
}: {
  shellHeight: number
  reservedHeight: number
  safeAreaInsetBottom?: number
  mode: ChatPaneMode
}): number => {
  if (mode === 'closed' || shellHeight <= 0) return 0

  const floor = CHAT_PANE_FLOOR_PX + safeAreaInsetBottom
  const wanted = Math.round(shellHeight * MODE_RATIO[mode])
  const upper = Math.max(floor, shellHeight - reservedHeight - CHAT_PANE_DOC_FLOOR_PX)

  return Math.min(Math.max(wanted, floor), upper)
}
