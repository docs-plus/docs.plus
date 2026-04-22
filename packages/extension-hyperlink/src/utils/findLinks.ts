import { find } from 'linkifyjs'

import { DEFAULT_PROTOCOL, normalizeLinkifyHref } from './normalizeHref'
import { isBarePhone } from './phone'
import { validateURL } from './validateURL'

const SPECIAL_SCHEME_REGEX_GLOBAL = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/g
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}]+$/

/** Shape every `findLinks` entry satisfies. Mirrors linkifyjs match shape plus our synthetic special-scheme / bare-phone entries. */
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
 * autolinks `google.com`, not `google.com.`. Only trims `href` when it
 * shares the trailing chars (i.e. plain URL matches, not `mailto:` etc.).
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
 * Find every link inside `text`. Merges three sources: linkifyjs
 * matches, special-scheme matches (gated through `validateURL` because
 * linkifyjs has no app-deep-link matchers), and bare E.164 phones.
 * The synthesized entries' `type` (`'url'` for special schemes,
 * `'phone'` for E.164) is load-bearing — `normalizeLinkifyHref` keys
 * off it to decide whether to re-canonicalize or pass through.
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

// Re-exported so `findLinks` callers don't need a second import.
export { DEFAULT_PROTOCOL, normalizeLinkifyHref }
