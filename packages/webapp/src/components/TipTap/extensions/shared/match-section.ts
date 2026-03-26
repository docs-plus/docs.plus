import type { Node as PMNode } from '@tiptap/pm/model'

interface TextMatch {
  from: number
  to: number
}

export interface SectionInfo {
  id: string
  pos: number
  level: number
  childIndex: number
}

export interface SectionMatch {
  section: SectionInfo
  matches: TextMatch[]
}

export interface FilterResult {
  matchedIds: Set<string>
  totalSections: number
}

/**
 * Walk top-level doc nodes and collect heading section info.
 * Skips the first heading (title H1, always visible).
 */
export function findAllSections(doc: PMNode): SectionInfo[] {
  const sections: SectionInfo[] = []
  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const pos = offset
    offset += child.nodeSize

    if (child.type.name !== 'heading') continue
    if (i === 0) continue

    const id = child.attrs['toc-id'] as string
    if (!id) continue

    sections.push({
      id,
      pos,
      level: child.attrs.level as number,
      childIndex: i
    })
  }

  return sections
}

function searchTextInRange(doc: PMNode, from: number, to: number, query: string): TextMatch[] {
  if (!query) return []

  const matches: TextMatch[] = []
  const lowerQuery = query.toLowerCase()
  const queryLen = lowerQuery.length

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return

    const text = node.text.toLowerCase()
    let searchStart = 0

    while (searchStart <= text.length - queryLen) {
      const idx = text.indexOf(lowerQuery, searchStart)
      if (idx === -1) break

      const absFrom = pos + idx
      const absTo = absFrom + queryLen

      if (absFrom >= from && absTo <= to) {
        matches.push({ from: absFrom, to: absTo })
      }

      searchStart = idx + 1
    }
  })

  return matches
}

function computeOwnRange(
  doc: PMNode,
  headingPos: number,
  headingChildIndex: number
): { from: number; to: number } {
  let offset = headingPos
  offset += doc.content.child(headingChildIndex).nodeSize

  for (let i = headingChildIndex + 1; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    if (child.type.name === 'heading') return { from: headingPos, to: offset }
    offset += child.nodeSize
  }

  return { from: headingPos, to: offset }
}

export function matchSections(doc: PMNode, query: string): SectionMatch[] {
  if (!query.trim()) return []

  const sections = findAllSections(doc)
  const results: SectionMatch[] = []

  for (const section of sections) {
    const range = computeOwnRange(doc, section.pos, section.childIndex)
    const matches = searchTextInRange(doc, range.from, range.to, query)

    if (matches.length > 0) {
      results.push({ section, matches })
    }
  }

  return results
}

function getAncestorIds(sections: SectionInfo[], matchedIds: Set<string>): Set<string> {
  const ancestors = new Set<string>()
  const stack: SectionInfo[] = []

  for (const section of sections) {
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop()
    }

    if (matchedIds.has(section.id)) {
      for (const ancestor of stack) {
        ancestors.add(ancestor.id)
      }
    }

    stack.push(section)
  }

  return ancestors
}

function getDescendantIds(sections: SectionInfo[], matchedIds: Set<string>): Set<string> {
  const descendants = new Set<string>()

  for (let i = 0; i < sections.length; i++) {
    if (!matchedIds.has(sections[i].id)) continue

    const parentLevel = sections[i].level
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= parentLevel) break
      descendants.add(sections[j].id)
    }
  }

  return descendants
}

export function filterSections(doc: PMNode, slugs: string[], mode: 'or' | 'and'): FilterResult {
  const sections = findAllSections(doc)
  const totalSections = sections.length

  if (slugs.length === 0) {
    return {
      matchedIds: new Set(sections.map((s) => s.id)),
      totalSections
    }
  }

  const perSlugSectionIds: Map<string, Set<string>> = new Map()

  for (const slug of slugs) {
    const sectionMatches = matchSections(doc, slug)
    perSlugSectionIds.set(slug, new Set(sectionMatches.map((sm) => sm.section.id)))
  }

  let directMatchIds: Set<string>

  if (mode === 'or') {
    directMatchIds = new Set<string>()
    for (const ids of perSlugSectionIds.values()) {
      for (const id of ids) directMatchIds.add(id)
    }
  } else {
    const idSets = [...perSlugSectionIds.values()]
    directMatchIds = new Set([...idSets[0]].filter((id) => idSets.every((s) => s.has(id))))
  }

  const ancestorIds = getAncestorIds(sections, directMatchIds)
  const descendantIds = getDescendantIds(sections, directMatchIds)
  const matchedIds = new Set([...directMatchIds, ...ancestorIds, ...descendantIds])

  return { matchedIds, totalSections }
}
