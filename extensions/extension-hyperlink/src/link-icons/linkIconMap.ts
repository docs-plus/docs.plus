import { httpUrl, type IconUrls, imgIcon, pairIcon } from './imgIcon'
import type { LinkIconResolver, LinkIconSource } from './types'

const BAD_KEY = /[/:?#@*%\s]/
const bare = (h: string) => h.replace(/\.$/, '').replace(/^www\./, '')
const normKey = (k: string) => {
  if (BAD_KEY.test(k)) throw new TypeError(`linkIconMap: bad key "${k}"`)
  return bare(new URL(`http://${k}`).hostname) // IDN keys become punycode, like hrefs
}

/** Offline domain map. Ignores www., matches subdomains, longest entry wins. http(s) only. */
export function linkIconMap(entries: Record<string, LinkIconSource>): LinkIconResolver {
  const table = new Map<string, LinkIconSource>()
  const urls: IconUrls = new Map()
  for (const [k, v] of Object.entries(entries)) table.set(normKey(k), v) // later key wins
  return ({ href }) => {
    const u = httpUrl(href)
    if (!u) return null
    for (let h = bare(u.hostname); ; h = h.slice(h.indexOf('.') + 1)) {
      const v = table.get(h)
      if (v !== undefined)
        return typeof v === 'string'
          ? imgIcon(v, false, urls)
          : typeof v === 'function'
            ? v()
            : pairIcon(v.light, v.dark)
      if (!h.includes('.')) return null
    }
  }
}
