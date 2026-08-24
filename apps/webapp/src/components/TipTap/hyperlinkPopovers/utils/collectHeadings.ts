import type { Editor } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'

import type { HeadingLevel, HeadingSuggestion } from '../types'

export function collectHeadings(editor: Editor): HeadingSuggestion[] {
  const out: HeadingSuggestion[] = []

  editor.state.doc.descendants((node) => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) return
    const id = node.attrs['toc-id'] as string | undefined
    const level = node.attrs.level as HeadingLevel
    const title = (node.textContent ?? '').trim()
    if (!id || !title) return

    out.push({ kind: 'heading', id, title, level })
  })

  return out
}
