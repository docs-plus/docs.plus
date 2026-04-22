// Package-level constants. Most are module-internal; `SAFE_WINDOW_FEATURES`
// is re-exported from `utils/index.ts` so downstream consumers (e.g. the
// webapp's own click-handlers) can pin the same `window.open` features
// string the extension uses.

/**
 * Mark name for the hyperlink. Load-bearing: stored in every Yjs doc
 * and referenced by webapp markdown round-trip. Renaming is breaking.
 */
export const HYPERLINK_MARK_NAME = 'hyperlink' as const

/**
 * Transaction `meta` key stamped by every command that writes or
 * removes a hyperlink mark, so `autolinkPlugin` skips the same tick
 * and doesn't undo the explicit edit.
 */
export const PREVENT_AUTOLINK_META = 'preventAutolink' as const

/**
 * `window.open` features string for safe navigation. Tabnabbing belt-
 * and-braces: `rel="noopener noreferrer nofollow"` on the rendered <a>
 * covers normal clicks, but every `window.open(href, '_blank', …)` call
 * is its own surface and needs an explicit features arg — without it
 * the opened tab can read `window.opener` and the Referer leaks.
 *
 * Used by the click handler (read-only fallback + middle-click), the
 * preview popover's "Open" button, and (re-exported) by webapp consumers
 * that ship their own preview UI bypassing the extension's hardened path.
 */
export const SAFE_WINDOW_FEATURES = 'noopener,noreferrer' as const
