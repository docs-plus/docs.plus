import type { FilterArgs, FilterResult } from '../types'

const URL_SHAPE = /^(https?:\/\/|mailto:|ftp:)/

export function isUrlShaped(input: string): boolean {
  return URL_SHAPE.test(input.trim())
}

/** URL-shaped queries pass through unfiltered; otherwise rank starts-with above contains. */
export function filterSuggestions({ query, headings, bookmarks }: FilterArgs): FilterResult {
  const trimmed = query.trim()
  if (!trimmed || isUrlShaped(trimmed)) {
    return { headings, bookmarks }
  }

  const needle = trimmed.toLowerCase()
  return {
    headings: rank(headings, needle),
    bookmarks: rank(bookmarks, needle)
  }
}

function rank<T extends { title: string }>(items: T[], needle: string): T[] {
  const startsWith: T[] = []
  const contains: T[] = []
  for (const item of items) {
    const title = item.title.toLowerCase()
    if (title.startsWith(needle)) startsWith.push(item)
    else if (title.includes(needle)) contains.push(item)
  }
  return [...startsWith, ...contains]
}
