/**
 * Syncs VisualViewport geometry to root CSS custom properties for the mobile shell
 * (`_mobile.scss`) and `globals.scss` (`--vh`).
 *
 * When iOS shifts the visual viewport (keyboard + scroll; `visualViewport.offsetTop` / `offsetLeft`
 * non-zero), `position:fixed;top:0` chrome no longer matches the visible band — set offsets + width
 * so `.mobileLayoutRoot` tracks the visual viewport rectangle.
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
