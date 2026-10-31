import type { Editor } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'
import slugify from 'slugify'

export type HeadingAncestor = {
  id: string
  level: number
  text: string
}

/** `[a-z0-9.-]` only, so a slug never needs encoding. The `>` join reads as a breadcrumb. */
export function headingSlug(text: string): string {
  return slugify(text.replace(/['’]/g, ''), { lower: true, trim: true })
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/** Title is stack[0]. Same-or-higher level pops siblings; Title never pops. */
export function headingAncestry(editor: Editor, headingId: string): HeadingAncestor[] {
  const doc = editor.state.doc
  const stack: HeadingAncestor[] = []
  const TITLE_ROOT = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

    const level = child.attrs.level as number
    const id = child.attrs['toc-id'] as string
    const text = child.textContent.trim()

    while (stack.length - 1 > TITLE_ROOT && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    stack.push({ id, level, text })

    if (id === headingId) return stack
  }

  return []
}

export function headingSlugTrail(editor: Editor, headingId: string): string {
  return headingAncestry(editor, headingId)
    .map((heading) => headingSlug(heading.text))
    .join('>')
}
