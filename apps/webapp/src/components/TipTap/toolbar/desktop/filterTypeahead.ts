import type { Node as PMNode } from '@tiptap/pm/model'

import { matchSections } from '../../extensions/shared/match-section'

export type FilterTypeaheadMatch = {
  id: string
  text: string
}

export function searchFilterSections(doc: PMNode, query: string, max = 8): FilterTypeaheadMatch[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const seen = new Set<string>()
  const out: FilterTypeaheadMatch[] = []

  for (const { section } of matchSections(doc, trimmed)) {
    if (seen.has(section.id)) continue
    const text = doc.content.child(section.childIndex).textContent.trim()
    if (!text) continue
    seen.add(section.id)
    out.push({ id: section.id, text })
    if (out.length >= max) break
  }

  return out
}
