import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { useEffect } from 'react'

/** Pad / history mobile editor surface (see `MobileLayout`, `MobileHistory`). */
const MOBILE_DOC_EDITOR_SELECTOR = '.mobileLayoutRoot .tiptap__editor.docy_editor'

/**
 * iOS Safari sometimes omits a final visualViewport resize when focusing the editor.
 * Re-apply `--visual-viewport-height` / `--vh` on focus capture so the shell matches WebKit.
 */
export function useVisualViewportCssSyncOnFocus(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (!t.closest(MOBILE_DOC_EDITOR_SELECTOR)) return
      syncVisualViewportToCssVars()
    }

    document.addEventListener('focusin', onFocusIn, true)
    return () => document.removeEventListener('focusin', onFocusIn, true)
  }, [enabled])
}
