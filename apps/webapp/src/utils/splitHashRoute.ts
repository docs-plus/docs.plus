export type HashRouteParts = {
  route: string
  /** Keeps the leading `?`, so `URLSearchParams` reads it as it stands. */
  search: string
}

/**
 * Splits the `#<route>?<query>` grammar at the first `?`. It knows the separator
 * only, never a route name, so it stays a splitter and not a route table.
 */
export function splitHashRoute(hash: string): HashRouteParts {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const q = raw.indexOf('?')
  if (q === -1) return { route: raw, search: '' }
  return { route: raw.slice(0, q), search: raw.slice(q) }
}
