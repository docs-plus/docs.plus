import type { JSONContent } from '@tiptap/core'

import { keepPreferredIds } from '../../extensions/shared/keep-preferred-ids'

/** One top-level heading, read the way the id matcher compares two of them. */
export interface HeadingRecord {
  level: number
  text: string
  /** Ancestor heading texts, by the flat-schema rule of `outlineOf`. */
  path: string
  /** Plain text up to the next heading, whitespace collapsed. */
  body: string
  id: string | null
  /** Tier 0 input for paste (#700). A replace never sets it. */
  preferredId?: string | null
}

// Inline children join with nothing, so marks never split a word. Blocks join with a space.
const plainText = (node: JSONContent): string => {
  if (node.type === 'hardBreak') return ' '
  if (node.text !== undefined) return node.text
  const children = node.content ?? []
  const inline = children.some((child) => child.type === 'text')
  return children.map(plainText).join(inline ? '' : ' ')
}

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim()

export const headingRecords = (doc: JSONContent): HeadingRecord[] => {
  const records: HeadingRecord[] = []
  const bodies: string[][] = []
  const stack: HeadingRecord[] = []
  for (const node of doc.content ?? []) {
    if (node.type !== 'heading') {
      bodies.at(-1)?.push(plainText(node))
      continue
    }
    const level = Number(node.attrs?.level)
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const id = node.attrs?.['toc-id']
    const record: HeadingRecord = {
      level,
      text: collapse(plainText(node)),
      path: JSON.stringify(stack.map((h) => h.text)),
      body: '',
      id: typeof id === 'string' && id !== '' ? id : null
    }
    records.push(record)
    bodies.push([])
    stack.push(record)
  }
  records.forEach((record, i) => (record.body = collapse(bodies[i].join(' '))))
  return records
}

const countBy = (records: HeadingRecord[], key: (h: HeadingRecord) => string) => {
  const counts = new Map<string, number>()
  for (const h of records) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1)
  return counts
}

/**
 * The old `toc-id` for each incoming heading, or `null` for a new id. Each tier runs over
 * every heading before the next tier starts, so a weak match never takes an id from a
 * strong one. Each old id goes at most once. Titles are never fuzzy-matched.
 * `reservedId` (the pad's documentId, the pad-wide chat) is never given out.
 */
export const pickHeadingIds = (
  old: HeadingRecord[],
  incoming: HeadingRecord[],
  reservedId: string | null = null
): (string | null)[] => {
  // Only the first copy of a repeated old id can be picked, so no id goes out twice.
  // An old heading that wrongly holds the reserved id never passes it on.
  const oldIds = new Set<string>()
  const candidates: HeadingRecord[] = []
  for (const h of old) {
    if (h.id === null || h.id === reservedId || oldIds.has(h.id)) continue
    oldIds.add(h.id)
    candidates.push(h)
  }
  const used = new Set<string>()

  const picked = keepPreferredIds(
    incoming.map((h) => ({
      preferredId: h.preferredId && oldIds.has(h.preferredId) ? h.preferredId : null
    })),
    new Set(),
    reservedId ? [reservedId] : []
  )
  picked.forEach((id) => id && used.add(id))

  const tier = (key: (h: HeadingRecord) => string | null) => {
    const free = new Map<string, HeadingRecord[]>()
    for (const h of candidates) {
      const k = key(h)
      if (k !== null && !used.has(h.id as string)) free.set(k, [...(free.get(k) ?? []), h])
    }
    // A same-body old heading wins a tie, then document order.
    for (const sameBody of [true, false]) {
      incoming.forEach((h, i) => {
        const k = picked[i] === null ? key(h) : null
        const match =
          k === null
            ? undefined
            : free
                .get(k)
                ?.find((o) => !used.has(o.id as string) && (!sameBody || o.body === h.body))
        if (!match) return
        picked[i] = match.id
        used.add(match.id as string)
      })
    }
  }

  tier((h) => (h.text ? JSON.stringify([h.level, h.text, h.path]) : null))
  tier((h) => (h.text ? JSON.stringify([h.level, h.text]) : null))
  tier((h) => h.text || null)
  // A rename: the section text appears exactly once on each side.
  const oldBodies = countBy(old, (h) => h.body)
  const newBodies = countBy(incoming, (h) => h.body)
  tier((h) =>
    h.body && oldBodies.get(h.body) === 1 && newBodies.get(h.body) === 1 ? h.body : null
  )

  return picked
}

/** What a replace does to the old headings: the ones whose id it carries, and the rest. */
export const headingIdPlan = (
  current: JSONContent,
  imported: JSONContent,
  reservedId: string | null = null
) => {
  const old = headingRecords(current)
  const carried = new Set(pickHeadingIds(old, headingRecords(imported), reservedId))
  const withId = old.filter((h) => h.id !== null)
  return {
    kept: withId.filter((h) => carried.has(h.id)),
    dropped: withId.filter((h) => !carried.has(h.id))
  }
}

/**
 * A file carries no `toc-id`, and heading chats, `?id=` links, folds and the digest pair
 * by it. So each imported top-level heading takes an old id through `pickHeadingIds`.
 * A heading with no match loses any id it came with, and `UniqueID` gives it a new one.
 */
export const carryHeadingIds = (
  current: JSONContent,
  imported: JSONContent,
  reservedId: string | null = null
): JSONContent => {
  const picked = pickHeadingIds(headingRecords(current), headingRecords(imported), reservedId)
  let index = 0
  return {
    ...imported,
    content: imported.content?.map((node) => {
      if (node.type !== 'heading') return node
      const id = picked[index++]
      const { 'toc-id': _incoming, ...attrs } = node.attrs ?? {}
      return { ...node, attrs: id ? { ...attrs, 'toc-id': id } : attrs }
    })
  }
}
