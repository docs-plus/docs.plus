import { isRecord } from './isRecord'

/**
 * Plain text of a stored snapshot's blocks, one run per textblock. Iterative
 * because a stored snapshot's depth is not bounded by the write-path caps.
 * The separator is the caller's: a reader wants lines, a word count wants spaces.
 */
export const blockText = (nodes: unknown[], separator: string): string => {
  const lines: string[] = []
  const stack: unknown[] = [...nodes].reverse()

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

  return lines.join(separator)
}
