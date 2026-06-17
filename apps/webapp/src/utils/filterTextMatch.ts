/** Case-insensitive substring index that can never throw on user input
 *  (unlike `new RegExp`). Mirrors the editor's match-section substring rule. */
export function filterTextMatchIndex(haystack: string, needle: string): number {
  const q = needle.trim()
  if (!q) return -1
  return haystack.toLowerCase().indexOf(q.toLowerCase())
}

export function filterTextMatch(haystack: string, needle: string): boolean {
  return filterTextMatchIndex(haystack, needle) !== -1
}
