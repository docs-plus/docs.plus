/** Decodes a URL part for reading. A malformed escape stays as written. */
export const decodeForReading = (raw: string): string => {
  try {
    return decodeURI(raw)
  } catch {
    return raw
  }
}

/**
 * Host, the path alone, and the path with query and hash, decoded for reading. A bare `/`
 * says nothing the host does not, so it reads as empty. The copy keeps the raw href.
 */
export const linkParts = (href: string): { host: string; path: string; rest: string } => {
  try {
    const url = new URL(href, window.location.origin)
    const path = decodeForReading(url.pathname)
    const rest = decodeForReading(`${url.pathname}${url.search}${url.hash}`)
    return { host: url.host, path: path === '/' ? '' : path, rest: rest === '/' ? '' : rest }
  } catch {
    return { host: href, path: '', rest: '' }
  }
}
