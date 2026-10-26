import { httpUrl, imgIcon } from './imgIcon'
import type { LinkIconFetcherOptions, LinkIconResolver } from './types'

/** One icon per origin; the img does its own fetch. Pure at build time. http(s) only. */
export function linkIconFetcher({ src, tile = false }: LinkIconFetcherOptions): LinkIconResolver {
  const failed = new Set<string>()
  return ({ href }) => {
    const u = httpUrl(href)
    return u ? imgIcon(src(u.origin), tile, failed) : null
  }
}
