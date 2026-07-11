/** Next `[...slugs]` query is string or string[] depending on segment count. */
export function normalizeSlugQuery(slugs: string | string[] | undefined): string[] {
  if (!slugs) return []
  return Array.isArray(slugs) ? slugs : [slugs]
}

function parseAsPath(asPath: string): URL {
  return new URL(asPath, 'http://localhost')
}

function shallowPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}

/** Shallow router.push expects a path — not a full origin URL. */
export function shallowPathFromAsPath(asPath: string): string {
  return shallowPath(parseAsPath(asPath))
}

export function appendFilterSegment(asPath: string, term: string): string | null {
  const trimmed = term.trim()
  if (!trimmed) return null

  const url = parseAsPath(asPath)
  const segments = url.pathname.split('/').filter(Boolean)
  const lower = trimmed.toLowerCase()
  const isDuplicate = segments.some(
    (segment, index) => index > 0 && decodeURIComponent(segment).toLowerCase() === lower
  )
  if (isDuplicate) return shallowPathFromAsPath(asPath)

  const base = url.pathname.replace(/\/$/, '')
  url.pathname = `${base}/${encodeURIComponent(trimmed)}`
  return shallowPath(url)
}

export function setFilterMode(asPath: string, mode: 'or' | 'and'): string {
  const url = parseAsPath(asPath)
  if (mode === 'and') url.searchParams.set('mode', 'and')
  else url.searchParams.delete('mode')
  return shallowPath(url)
}

export function removeFilterSegment(asPath: string, slug: string): string | null {
  if (!slug.trim()) return null

  const url = parseAsPath(asPath)
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments.length) return null

  const [docSlug, ...filterSlugs] = segments
  const lower = slug.toLowerCase()
  const updatedFilters = filterSlugs.filter(
    (segment) => decodeURIComponent(segment).toLowerCase() !== lower
  )

  url.pathname = `/${docSlug}${updatedFilters.length ? '/' + updatedFilters.join('/') : ''}`
  // Mode only applies with ≥2 terms — drop it when the filter set empties.
  if (updatedFilters.length === 0) url.searchParams.delete('mode')
  return shallowPath(url)
}

export function resetFilterPath(asPath: string): string | null {
  const url = parseAsPath(asPath)
  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments.length) return null

  url.pathname = `/${segments[0]}`
  // Reset clears filter state entirely, including AND preference.
  url.searchParams.delete('mode')
  return shallowPath(url)
}
