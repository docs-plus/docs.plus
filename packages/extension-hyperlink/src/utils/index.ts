/**
 * Public utility surface for `@docs.plus/extension-hyperlink`.
 *
 * Symbols are listed explicitly (no `export *`) so the package contract
 * is auditable from this one file. Module-internal helpers — `Link` /
 * `Title` icons (only used by the prebuilt popovers), `getURLScheme`
 * (only used inside `validateURL`), `isBarePhone` (only used inside
 * `autolink` / `normalizeHref` / `validateURL`), `normalizeLinkifyHref`
 * (only used inside the autolink + paste plugins) — stay reachable from
 * sibling modules but do not leak through the package barrel.
 */
export { SAFE_WINDOW_FEATURES } from '../constants'
export { copyToClipboard } from './copyToClipboard'
export { createHTMLElement } from './createHTMLElement'
export { Copy, LinkOff, Pencil } from './icons'
export { type LinkifyMatchLike, normalizeHref } from './normalizeHref'
export { getSpecialUrlInfo, type SpecialUrlInfo, type SpecialUrlType } from './specialUrls'
export { DANGEROUS_SCHEME_RE, isSafeHref, validateURL } from './validateURL'
