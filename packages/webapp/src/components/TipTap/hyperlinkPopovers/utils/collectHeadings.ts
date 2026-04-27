import type { Editor } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'
import slugify from 'slugify'

import type { HeadingLevel, HeadingSuggestion } from '../types'

/** Walk the doc once; emit headings that have both `toc-id` and text. */
export function collectHeadings(editor: Editor): HeadingSuggestion[] {
  const out: HeadingSuggestion[] = []
  const stack: string[] = []

  editor.state.doc.descendants((node) => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) return
    const id = node.attrs['toc-id'] as string | undefined
    const level = node.attrs.level as HeadingLevel
    const title = (node.textContent ?? '').trim()
    if (!id || !title) return

    stack.length = level - 1
    stack[level - 1] = slugify(title.toLowerCase())

    out.push({
      kind: 'heading',
      id,
      title,
      level,
      breadcrumb: stack.slice(0, level)
    })
  })

  return out
}
