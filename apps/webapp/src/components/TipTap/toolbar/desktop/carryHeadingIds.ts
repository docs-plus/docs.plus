import type { JSONContent } from '@tiptap/core'

const textOf = (node: JSONContent): string => node.text ?? (node.content ?? []).map(textOf).join('')

const headingKey = (node: JSONContent): string => `${node.attrs?.level}|${textOf(node)}`

/**
 * A file carries no `toc-id`, and heading chats, section links and the digest pair by
 * it. So an imported heading takes the old id of a top-level heading with the same
 * level and text. Each id goes once, in document order. No match stays for `UniqueID`.
 */
export const carryHeadingIds = (current: JSONContent, imported: JSONContent): JSONContent => {
  const pool = new Map<string, string[]>()
  for (const node of current.content ?? []) {
    const id = node.attrs?.['toc-id']
    if (node.type !== 'heading' || typeof id !== 'string' || id === '') continue
    const key = headingKey(node)
    pool.set(key, [...(pool.get(key) ?? []), id])
  }

  return {
    ...imported,
    content: imported.content?.map((node) => {
      if (node.type !== 'heading') return node
      const id = pool.get(headingKey(node))?.shift()
      return id ? { ...node, attrs: { ...node.attrs, 'toc-id': id } } : node
    })
  }
}
