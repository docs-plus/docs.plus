import type { Editor } from '@tiptap/core'
import { headingAncestry } from '@utils/headingSlugTrail'
import { buildHeadingHref } from '@utils/link-helpers'

export type HeadingCrumb = { text: string; id: string }
export type HeadingBreadcrumbItem = HeadingCrumb & { url: string }

export function buildHeadingPath(editor: Editor, headingId: string): HeadingCrumb[] {
  return headingAncestry(editor, headingId).map(({ text, id }) => ({ text, id }))
}

export function resolveHeadingBreadcrumbs(
  editor: Editor,
  headingId: string
): HeadingBreadcrumbItem[] | null {
  const path = buildHeadingPath(editor, headingId)
  if (path.length === 0) return null
  return path.map((crumb) => ({
    ...crumb,
    url: buildHeadingHref(editor, crumb.id)
  }))
}
