import { Node } from '@tiptap/core'

// StarterKit's own Link types would clash with the `setLink` aliases, so tests build a bare schema.
export const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
export const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0]
})
export const Text = Node.create({ name: 'text', group: 'inline' })
