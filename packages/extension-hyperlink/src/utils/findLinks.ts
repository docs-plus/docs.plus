import { find } from 'linkifyjs'

import { DEFAULT_PROTOCOL, normalizeLinkifyHref } from './normalizeHref'
import { isBarePhone } from './phone'
import { validateURL } from './validateURL'

const SPECIAL_SCHEME_REGEX_GLOBAL = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/g
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}]+$/

/**
 * Shape every entry in the `findLinks` result satisfies. Compatible with
 * linkifyjs's own match shape (which carries `type`, `href`, `value`,
 * `start`, `end`, `isLink`) plus the manually constructed special-scheme
 * and bare-phone entries `findLinks` synthesises.
 */
export type FoundLink = {
  type: string
  href: string
  value: string
  start: number
  end: number
  isLink: boolean
}

/**
 * Trim trailing punctuation from the match range so "Visit google.com."
 * autolinks `google.com`, not `google.com.`. `href` and `value` only
 * diverge for linkifyjs email / custom-scheme matches (`mailto:…` vs
 * raw email text) — there the scheme prefix means `href` won't share
 * the trailing punctuation, so we leave it alone.
 */
const stripTrailingPunctuation = <T extends { value: string; href: string; end: number }>(
  link: T
): T => {
  const tail = link.value.match(TRAILING_PUNCTUATION_RE)
  if (!tail) return link
  const len = tail[0].length
  return {
    ...link,
    value: link.value.slice(0, -len),
    href: link.href.endsWith(tail[0]) ? link.href.slice(0, -len) : link.href,
    end: link.end - len
  }
}

/**
 * Find every link inside a single token of text.
 *
 * Three sources are merged into one stable result list:
 *   1. linkifyjs's own matches (`http(s)://`, `mailto:`, `tel:`, …).
 *   2. Special-scheme matches (`whatsapp://`, `vscode:`, …) — linkifyjs
 *      doesn't ship matchers for app deep-links, so we scan with a
 *      regex and gate them through `validateURL` before promoting them
 *      to "URL" matches. Tagged `type: 'url'` so `normalizeLinkifyHref`
 *      passes them through unchanged (they already carry a scheme).
 *   3. Bare E.164 phones — linkifyjs has no phone matcher. Tagged
 *      `type: 'phone'` so `normalizeLinkifyHref` returns the canonical
 *      `tel:+CCNSN` href verbatim instead of re-running `normalizeHref`.
 *
 * `defaultProtocol` is consumed by callers via `normalizeLinkifyHref`
 * for bare-domain promotion; `findLinks` itself only identifies.
 */
export const findLinks = (text: string): FoundLink[] => {
  const links: FoundLink[] = []

  const standardLinks = (find(text) as FoundLink[]).filter((link) => link.isLink)
  links.push(...standardLinks)

  for (const match of text.matchAll(SPECIAL_SCHEME_REGEX_GLOBAL)) {
    const url = match[0]
    const start = match.index!
    const end = start + url.length
    const alreadyCovered = standardLinks.some((link) => start >= link.start && end <= link.end)
    if (!alreadyCovered && validateURL(url)) {
      links.push({ type: 'url', href: url, value: url, start, end, isLink: true })
    }
  }

  // Phones. `text` is a single whitespace-delimited token at the
  // autolink call site, so neither an inline scan nor an
  // `alreadyCovered` check is needed here.
  const phone = isBarePhone(text)
  if (phone.ok) {
    links.push({
      type: 'phone',
      href: phone.href,
      value: text,
      start: 0,
      end: text.length,
      isLink: true
    })
  }

  return links.map(stripTrailingPunctuation)
}

/**
 * Re-export so callers that already import `findLinks` can keep the
 * `defaultProtocol` accessible for downstream `normalizeLinkifyHref`
 * calls without a separate import.
 */
export { DEFAULT_PROTOCOL, normalizeLinkifyHref }
