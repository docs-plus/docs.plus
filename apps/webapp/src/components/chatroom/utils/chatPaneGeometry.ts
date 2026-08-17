import type { ChatPaneMode } from '@types'

/** Body copy the document always keeps, so its last section stays reachable. */
export const CHAT_PANE_DOC_FLOOR_PX = 96

/**
 * 160px is measured furniture (grabber 20 + header 53 + feed pad 20 + composer 61 = 154,
 * plus margin). The grabber matches the sheet header (20px). Safe-area is measured at
 * runtime — see `safeAreaInsetBottom`.
 */
export const CHAT_PANE_FLOOR_PX = 160

/** Drag this far below half and release closes, same threshold as the composer emoji handle. */
export const CHAT_PANE_CLOSE_DRAG_PX = 80

export const CHAT_PANE_SELECTOR = '.chatPane'
export const PAD_HEADER_SELECTOR = '.mobilePadTitleShell'
export const PANE_BODY_SELECTOR = '[data-chat-pane-body]'

export type ChatPaneShellMeasure = {
  shellHeight: number
  reservedHeight: number
  safeAreaInsetBottom: number
}

/**
 * One DOM read for the Chat pane and the grabber. `paddingBottom` resolves
 * `env(safe-area-inset-bottom)` to px; a custom property would not.
 */
export const readChatPaneShell = (pane: HTMLElement): ChatPaneShellMeasure | null => {
  const shell = pane.parentElement
  if (!shell) return null
  const header = shell.querySelector<HTMLElement>(PAD_HEADER_SELECTOR)
  const body = pane.querySelector<HTMLElement>(PANE_BODY_SELECTOR)
  return {
    shellHeight: shell.clientHeight,
    reservedHeight: header?.offsetHeight ?? 0,
    safeAreaInsetBottom: body ? parseFloat(getComputedStyle(body).paddingBottom) || 0 : 0
  }
}

const MODE_RATIO: Record<ChatPaneMode, number> = { closed: 0, half: 0.5, expanded: 1 }

/**
 * One clamp for every mode; `Math.max` keeps the pane usable when the shell is too short
 * for both floors. `reservedHeight` and `safeAreaInsetBottom` are both measured, not
 * assumed. Nothing here has to track the pad header's rendered size or bake in a notch
 * value that would over-reserve on other devices.
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

/** Release target after a grabber drag. Not a sheet detent — modes stay half / expanded / closed. */
export const snapChatPaneMode = ({
  height,
  halfHeight,
  expandedHeight
}: {
  height: number
  halfHeight: number
  expandedHeight: number
}): ChatPaneMode => {
  if (height <= halfHeight - CHAT_PANE_CLOSE_DRAG_PX) return 'closed'
  const mid = (halfHeight + expandedHeight) / 2
  return height >= mid ? 'expanded' : 'half'
}
