// JS mirror of the :root motion tokens in styles/_entry.scss — update both together.
export const MOTION_OVERLAY_IN_MS = 120
export const MOTION_OVERLAY_OUT_MS = 80
export const MOTION_PANEL_MS = 200
export const MOTION_DIALOG_IN_MS = 180
export const MOTION_DIALOG_OUT_MS = 150

// framer-motion tween for in-page panels (ComposerEmojiPanel outer-height pattern).
export const PANEL_TWEEN = { duration: 0.2, ease: 'easeOut' } as const

/**
 * Inline styles from useTransitionStyles/framer-motion beat any CSS
 * prefers-reduced-motion rule — JS-driven motion must gate here.
 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
