import { useStore } from '@stores'

export const VIRTUAL_KEYBOARD_HEIGHT_THRESHOLD_PX = 72

/**
 * Max visual viewport height seen while the keyboard was treated as **closed**.
 * On iOS (especially after double-tap / FAB cycles), `innerHeight` can shrink to match
 * `visualViewport.height` while the keyboard is up, so `innerHeight - vv.height` stays 0.
 * Comparing `vv.height` to this peak still detects the keyboard.
 */
let peakVisualViewportHeightPx = 0

let lastKeyboardOpen: boolean | null = null

export function resetVirtualKeyboardSessionBaseline(): void {
  peakVisualViewportHeightPx = 0
  lastKeyboardOpen = null
}

/**
 * Single source of truth for `isKeyboardOpen` / `keyboardHeight` (used by the hook + nudge).
 */
export function applyVirtualKeyboardToStore(): void {
  const vv = window.visualViewport
  if (!vv) return

  const vvh = vv.height
  const winH = window.innerHeight
  const layoutH = document.documentElement?.clientHeight ?? winH

  const deltaWin = Math.max(0, winH - vvh)
  const deltaLayout = Math.max(0, layoutH - vvh)

  if (peakVisualViewportHeightPx === 0) {
    peakVisualViewportHeightPx = Math.max(vvh, winH, layoutH)
  }

  // iOS: layout viewport can sit at scrollY > 0 while vv.height is already shrunk; infer a
  // taller “full” band so peak − vvh still detects the keyboard (matches double-tap → FAB races).
  const scrollY = window.scrollY
  if (scrollY > 8) {
    peakVisualViewportHeightPx = Math.max(peakVisualViewportHeightPx, vvh + scrollY)
  }

  const th = VIRTUAL_KEYBOARD_HEIGHT_THRESHOLD_PX
  const openByShrink = deltaWin > th || deltaLayout > th
  const openByPeak = peakVisualViewportHeightPx - vvh > th
  const isKeyboardOpen = openByShrink || openByPeak

  if (!isKeyboardOpen) {
    peakVisualViewportHeightPx = Math.max(peakVisualViewportHeightPx, vvh, winH, layoutH)
  }

  const keyboardHeight = isKeyboardOpen
    ? Math.max(deltaWin, deltaLayout, peakVisualViewportHeightPx - vvh)
    : 0

  const { setKeyboardOpen, setKeyboardHeight, keyboardHeight: prevHeight } = useStore.getState()

  if (lastKeyboardOpen !== isKeyboardOpen) {
    setKeyboardHeight(keyboardHeight)
    setKeyboardOpen(isKeyboardOpen)
    lastKeyboardOpen = isKeyboardOpen
  } else if (isKeyboardOpen && Math.abs(prevHeight - keyboardHeight) > 8) {
    setKeyboardHeight(keyboardHeight)
  }
}

/** After `editor.focus()` — same as listener path (no separate delta-only heuristic). */
export function nudgeVirtualKeyboardOpenFromVisualViewport(): void {
  applyVirtualKeyboardToStore()
}
