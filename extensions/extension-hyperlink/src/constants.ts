/** Hyperlink mark name. Load-bearing: stored in every Yjs doc; renaming is breaking. */
export const HYPERLINK_MARK_NAME = 'hyperlink' as const

/** Tx meta stamped by every hyperlink write so `autolinkPlugin` skips the same tick. */
export const PREVENT_AUTOLINK_META = 'preventAutolink' as const

/** Bail-out rect returned by an opener's coords callback while `popover.hide()` is queued. */
export const OFFSCREEN_COORD_PX = -9999

/**
 * Required `window.open` features. Without this arg the opened tab can
 * read `window.opener` and the Referer leaks. Re-exported so popovers pin it.
 */
export const SAFE_WINDOW_FEATURES = 'noopener,noreferrer' as const
