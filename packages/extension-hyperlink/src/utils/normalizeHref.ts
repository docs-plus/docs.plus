/**
 * Canonicalize a user-supplied href so it points somewhere absolute.
 *
 * `<a href="google.com">` is legal HTML but the browser treats it as a
 * relative URL — `anchor.href` (the click target) resolves to
 * `http://<current-origin>/google.com`. Running every user-typed href
 * through this helper at the write boundary keeps the stored mark
 * pointing where the user intended, regardless of the host page.
 *
 * Rules:
 *   1. Trim whitespace; empty → `''` (callers validate non-emptiness).
 *   2. If the value already has a scheme or is protocol-relative (`//x`),
 *      leave it alone.
 *   3. Otherwise, prepend `https://`.
 *
 * The scheme detector matches RFC 3986 §3.1 — permissive on purpose so
 * custom schemes (registered via `registerCustomProtocol(...)`) pass
 * through unmodified.
 */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

export const normalizeHref = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (SCHEME_RE.test(trimmed) || trimmed.startsWith('//')) return trimmed
  return `https://${trimmed}`
}

/**
 * Shape we depend on from a linkifyjs match (plus autolink's
 * manually-constructed special-scheme entries, which also set `type`).
 * Loosened to avoid importing linkifyjs types across the public boundary.
 */
export type LinkifyMatchLike = {
  type: string
  value: string
  href: string
}

/**
 * Canonicalize a linkifyjs match for storage.
 *
 * linkifyjs defaults URL matches to `http://…`; we prefer `https://` to
 * stay consistent with the create popover and markdown input rule, so
 * URL matches run through `normalizeHref(value)`. Non-URL matches
 * (emails → `mailto:`, etc.) already carry a meaningful scheme in `href`
 * and are returned unchanged.
 */
export const normalizeLinkifyHref = (link: LinkifyMatchLike): string => {
  return link.type === 'url' ? normalizeHref(link.value) : link.href
}
