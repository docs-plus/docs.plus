// Public utility surface — explicit named re-exports (no `export *`) so
// the package contract is auditable from this one file. Module-internal
// helpers (`Link` / `Title` icons, `getURLScheme`, `isBarePhone`,
// `normalizeLinkifyHref`) stay reachable from siblings but do NOT leak
// through this barrel.

export { SAFE_WINDOW_FEATURES } from '../constants'
export { copyToClipboard } from './copyToClipboard'
export { createHTMLElement } from './createHTMLElement'
export { Copy, LinkOff, Pencil } from './icons'
export { type LinkifyMatchLike, normalizeHref } from './normalizeHref'
export { getSpecialUrlInfo, type SpecialUrlInfo, type SpecialUrlType } from './specialUrls'
export { DANGEROUS_SCHEME_RE, isSafeHref, validateURL } from './validateURL'
