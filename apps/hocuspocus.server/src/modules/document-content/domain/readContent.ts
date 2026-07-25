import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import type { ReadFormat, ReadOutcome, TiptapDocJson } from '../types'
import { isRecord } from '../types'

/**
 * Block-level plain text, one line per textblock, in document order. Iterative
 * because a stored snapshot's depth is not bounded by the write-path caps.
 */
const extractText = (json: Record<string, unknown>): string => {
  const lines: string[] = []
  const root = Array.isArray(json.content) ? json.content : []
  const stack: unknown[] = [...root].reverse()

  while (stack.length > 0) {
    const node = stack.pop()
    if (!isRecord(node)) continue
    const children = node.content
    if (!Array.isArray(children)) continue

    if (children.some((child) => isRecord(child) && typeof child.text === 'string')) {
      lines.push(
        children
          .map((child) => (isRecord(child) && typeof child.text === 'string' ? child.text : ''))
          .join('')
      )
    }

    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i]
      if (isRecord(child) && Array.isArray(child.content)) stack.push(child)
    }
  }

  return lines.join('\n')
}

/** Persisted snapshot bytes → Tiptap JSON or plain text. Corrupt bytes fail closed. */
export const readContent = (data: Uint8Array | Buffer, format: ReadFormat): ReadOutcome => {
  const decoded = ydocToPmJson(data)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return {
    ok: true,
    content:
      format === 'text' ? extractText(decoded.json) : (decoded.json as unknown as TiptapDocJson)
  }
}

/** The shape GET returns for a document that has metadata but no snapshot row yet. */
export const emptyContent = (format: ReadFormat): TiptapDocJson | string =>
  format === 'text' ? '' : { type: 'doc', content: [] }
