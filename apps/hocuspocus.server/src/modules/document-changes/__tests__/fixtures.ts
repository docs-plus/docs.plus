import type { TiptapDocJson } from '../../document-content/types'

type Node = Record<string, unknown>

export const text = (value: string, marks?: Node[]): Node => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {})
})

export const heading = (level: number, label: string, tocId?: string): Node => ({
  type: 'heading',
  attrs: { level, ...(tocId === undefined ? {} : { 'toc-id': tocId }) },
  content: [text(label)]
})

export const para = (...pieces: Node[]): Node => ({ type: 'paragraph', content: pieces })

export const doc = (...content: Node[]): TiptapDocJson => ({ type: 'doc', content })

export const BOLD = [{ type: 'bold' }]
export const link = (href: string): Node[] => [{ type: 'link', attrs: { href } }]
