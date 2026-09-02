import type { Mark, Node as PMNode } from '@tiptap/pm/model'

/**
 * Lockstep copy of hocuspocus `VOLATILE_BLOCK_ATTRS` — this package cannot import
 * that one. Drift makes the first-open toc-id rewrite read as a real edit, and
 * lets the toc-id rewriter outrank the real writer in `blockAuthors`.
 */
export const VOLATILE_BLOCK_ATTRS: ReadonlySet<string> = new Set(['toc-id'])

/** Numbers for characters, strings for nodes, so the two can never compare equal. */
type DiffToken = number | string

/** Above every Unicode code point, so `markSetId * MARK_STRIDE + char` stays injective. */
const MARK_STRIDE = 0x200000

/** Sorted, null-free, volatile-free — the same shape the backend hashes. */
const stableAttrs = (attrs: Record<string, unknown> | null | undefined): string => {
  if (!attrs) return ''
  return Object.keys(attrs)
    .filter((key) => !VOLATILE_BLOCK_ATTRS.has(key) && attrs[key] !== null)
    .sort()
    .map((key) => `${key}=${JSON.stringify(attrs[key])}`)
    .join(',')
}

/**
 * Token encoder that sees marks and attributes, which the library default ignores.
 * Interning mark sets to integers keeps the library's cheap prefix/suffix trim
 * alive; a fresh object per character destroys it.
 */
export const buildDiffTokenEncoder = () => {
  const markSetIds = new Map<string, number>()

  const markSetId = (marks: readonly Mark[]): number => {
    if (marks.length === 0) return 0
    const key = marks
      .map((mark) => `${mark.type.name}(${stableAttrs(mark.attrs)})`)
      .sort()
      .join('|')
    let id = markSetIds.get(key)
    if (id === undefined) {
      id = markSetIds.size + 1
      markSetIds.set(key, id)
    }
    return id
  }

  return {
    encodeCharacter: (char: number, marks: readonly Mark[]): DiffToken =>
      markSetId(marks) * MARK_STRIDE + char,
    encodeNodeStart: (node: PMNode): DiffToken => `<${node.type.name}|${stableAttrs(node.attrs)}`,
    encodeNodeEnd: (node: PMNode): DiffToken => `>${node.type.name}`,
    compareTokens: (a: DiffToken, b: DiffToken): boolean => a === b
  }
}
