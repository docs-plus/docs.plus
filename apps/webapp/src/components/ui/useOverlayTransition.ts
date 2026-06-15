import { type FloatingContext, useTransitionStyles } from '@floating-ui/react'
import { MOTION_OVERLAY_IN_MS, MOTION_OVERLAY_OUT_MS, prefersReducedMotion } from '@utils/motion'

const ORIGIN_BY_SIDE: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
}

type OverlayTransitionOptions = {
  /** Tooltips pass false — opacity only, never scale. */
  scale?: boolean
  openMs?: number
  /** 0 = instant dismissal (context menus). */
  closeMs?: number
}

/**
 * Overlay-tier motion (docs.plus motion v1): enter ease-out, scale 0.96 from the
 * anchored side; exit opacity-only fade. Inline styles beat any CSS
 * prefers-reduced-motion rule, so the gate must live here, not in stylesheets.
 * Hosts using scale must position with `transform: false` on useFloating.
 */
export const useOverlayTransition = (
  context: FloatingContext,
  {
    scale = true,
    openMs = MOTION_OVERLAY_IN_MS,
    closeMs = MOTION_OVERLAY_OUT_MS
  }: OverlayTransitionOptions = {}
) => {
  return useTransitionStyles(context, {
    duration: prefersReducedMotion() ? 0 : { open: openMs, close: closeMs },
    initial: scale ? { opacity: 0, transform: 'scale(0.96)' } : { opacity: 0 },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' },
    common: ({ side }) => ({
      transitionTimingFunction: 'ease-out',
      ...(scale ? { transformOrigin: ORIGIN_BY_SIDE[side] } : {})
    })
  })
}
