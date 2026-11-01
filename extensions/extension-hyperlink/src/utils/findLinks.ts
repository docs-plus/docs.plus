import { find } from 'linkifyjs'

import { isBarePhone } from './phone'
import { stripTrailingPunctuation, validateURL } from './validateURL'

const SPECIAL_SCHEME_REGEX_GLOBAL = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/g

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
 * Merges linkifyjs matches with special-scheme matches (gated through
 * `validateURL` — linkifyjs has no app-deep-link matchers) and bare E.164
 * phones. The synthesized `type` is load-bearing: `normalizeLinkifyHref`
 * keys off it to decide whether to re-canonicalize or pass through.
 */
export const findLinks = (text: string): FoundLink[] => {
  const links: FoundLink[] = []

  const standardLinks = (find(text) as FoundLink[]).filter((link) => link.isLink)
  links.push(...standardLinks)

  // The special-scheme regex requires a `:`; skip the iterator entirely
  // on common keyword-token inputs that can't contain a scheme.
  if (text.includes(':')) {
    for (const match of text.matchAll(SPECIAL_SCHEME_REGEX_GLOBAL)) {
      // Linkify already leaves trailing punctuation out. Only this regex match needs the strip.
      const url = stripTrailingPunctuation(match[0])
      const start = match.index
      const end = start + url.length
      const alreadyCovered = standardLinks.some((link) => start >= link.start && end <= link.end)
      if (!alreadyCovered && validateURL(url)) {
        links.push({ type: 'url', href: url, value: url, start, end, isLink: true })
      }
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

  return links
}
