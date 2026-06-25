/**
 * Syncs VisualViewport geometry to root CSS custom properties for the mobile shell
 * (`_mobile.scss`) and `globals.scss` (`--vh`).
 */
export function syncVisualViewportToCssVars(root: HTMLElement = document.documentElement): void {
  const vv = window.visualViewport
  if (!vv) return
  const heightPx = Math.ceil(vv.height)
  const widthPx = Math.ceil(vv.width)
  root.style.setProperty('--visual-viewport-height', `${heightPx}px`)
  root.style.setProperty('--visual-viewport-width', `${widthPx}px`)
  root.style.setProperty('--visual-viewport-offset-top', `${vv.offsetTop}px`)
  root.style.setProperty('--visual-viewport-offset-left', `${vv.offsetLeft}px`)
  root.style.setProperty('--vh', `${heightPx * 0.01}px`)
}

/** Clears inline viewport vars so non-shell routes fall back to dvh/vh units. */
export function resetVisualViewportCssVars(root: HTMLElement = document.documentElement): void {
  root.style.removeProperty('--visual-viewport-height')
  root.style.removeProperty('--visual-viewport-width')
  root.style.removeProperty('--visual-viewport-offset-top')
  root.style.removeProperty('--visual-viewport-offset-left')
  root.style.removeProperty('--vh')
}
