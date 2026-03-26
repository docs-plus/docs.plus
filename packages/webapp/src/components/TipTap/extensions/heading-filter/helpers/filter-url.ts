const FILTER_PARAM = 'filter'
const MODE_PARAM = 'mode'
const DELIMITER = '|'

export function decodeFilterParams(
  searchString: string
): { slugs: string[]; mode: 'or' | 'and' } | null {
  const params = new URLSearchParams(searchString)
  const raw = params.get(FILTER_PARAM)
  if (!raw) return null
  const slugs = raw.split(DELIMITER).map(decodeURIComponent).filter(Boolean)
  const mode = params.get(MODE_PARAM) === 'and' ? 'and' : 'or'
  return slugs.length > 0 ? { slugs, mode } : null
}

export function updateFilterUrl(slugs: string[], mode: 'or' | 'and'): void {
  const url = new URL(window.location.href)
  if (slugs.length === 0) {
    url.searchParams.delete(FILTER_PARAM)
    url.searchParams.delete(MODE_PARAM)
  } else {
    url.searchParams.set(FILTER_PARAM, slugs.map(encodeURIComponent).join(DELIMITER))
    url.searchParams.set(MODE_PARAM, mode)
  }
  history.replaceState(null, '', url.toString())
}

export function readFilterUrl(): {
  slugs: string[]
  mode: 'or' | 'and'
} | null {
  if (typeof window === 'undefined') return null
  return decodeFilterParams(window.location.search)
}
