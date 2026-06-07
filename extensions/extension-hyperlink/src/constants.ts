// Package-level constants. `SAFE_WINDOW_FEATURES` is re-exported from
// `utils/index.ts`; the other two stay module-internal.

/** Hyperlink mark name. Load-bearing: stored in every Yjs doc; renaming is breaking. */
export const HYPERLINK_MARK_NAME = 'hyperlink' as const

/** Tx meta stamped by every hyperlink write so `autolinkPlugin` skips the same tick. */
export const PREVENT_AUTOLINK_META = 'preventAutolink' as const

/**
 * `window.open` features string for safe navigation — every
 * `window.open(href, '_blank', …)` call needs this explicit arg or the
 * opened tab can read `window.opener` and the Referer leaks. Re-exported
 * so downstream popovers pin the same value.
 */
export const SAFE_WINDOW_FEATURES = 'noopener,noreferrer' as const
