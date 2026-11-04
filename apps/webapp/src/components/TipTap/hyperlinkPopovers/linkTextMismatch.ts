import type { LinkTextMismatch } from './types'

// The whole text is one address: an optional http(s) scheme, a dotted host with at most one
// trailing dot, an optional port and an optional path.
const ADDRESS = /^(https?:\/\/)?((?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+)\.?(?::\d+)?(?:[/?#]\S*)?$/iu

// A bare `name.tld` needs a common ending, so `Node.js`, `README.md` or `app.py` never reads as a site.
const COMMON_TLDS = new Set(
  (
    'com org net edu gov io dev app ai co me info biz xyz site online tech cloud page plus ' +
    'us uk ca au nz ie de fr es it nl be ch at se no dk fi pt cz ru ua jp cn kr in br mx eu tv'
  ).split(' ')
)

const hostnameOf = (address: string): string | null => {
  try {
    return new URL(address).hostname
  } catch {
    return null
  }
}

// `github.com.` is `github.com`: a trailing dot names the same host.
const bare = (hostname: string): string => hostname.replace(/^www\./, '').replace(/\.$/, '')

/** One site is the other, or a subdomain of it on a dot boundary. Siblings still count as different. */
const sameSite = (a: string, b: string): boolean =>
  a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)

/**
 * `null` unless the link's own text is a web address whose site differs from where it opens.
 * Ordinary words, file names and version numbers never match. `href` is an absolute web URL.
 */
export const linkTextMismatch = (text: string, href: string): LinkTextMismatch | null => {
  const match = ADDRESS.exec(text.trim())
  if (!match) return null
  const [, scheme, host] = match
  const tld = host.slice(host.lastIndexOf('.') + 1).toLowerCase()
  if (!scheme && !/^www\./i.test(host) && !COMMON_TLDS.has(tld)) return null

  const textHost = hostnameOf(`https://${host}`)
  const linkHost = hostnameOf(href)
  if (!textHost || !linkHost || sameSite(bare(textHost), bare(linkHost))) return null
  return { says: host, opens: linkHost }
}
