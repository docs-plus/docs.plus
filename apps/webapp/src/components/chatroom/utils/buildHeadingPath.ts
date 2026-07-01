import type { Editor } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'
import slugify from 'slugify'

export type HeadingCrumb = { text: string; id: string }
export type HeadingBreadcrumbItem = HeadingCrumb & { slug: string; url: string }

/** Walk flat doc headings to build ancestor chain for a target toc-id. */
export function buildHeadingPath(editor: Editor, headingId: string): HeadingCrumb[] {
  const doc = editor.state.doc
  const result: Array<HeadingCrumb & { level: number }> = []
  let targetLevel = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)

    if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

    const tocId = child.attrs['toc-id'] as string
    const level = child.attrs.level as number
    const text = child.textContent?.trim() || ''

    if (tocId === headingId) {
      targetLevel = level
      result.push({ text, id: tocId, level })
      break
    }

    result.push({ text, id: tocId, level })
  }

  if (targetLevel === 0) return []

  const ancestors: HeadingCrumb[] = []
  const seen = new Set<number>()

  for (let i = result.length - 2; i >= 0; i--) {
    const h = result[i]
    if (h.level < targetLevel && !seen.has(h.level)) {
      seen.add(h.level)
      ancestors.unshift({ text: h.text, id: h.id })
      if (h.level === 1) break
    }
  }

  const target = result[result.length - 1]
  return [...ancestors, { text: target.text, id: target.id }]
}

export function buildHeadingBreadcrumbItems(
  path: HeadingCrumb[],
  docSlug: string
): HeadingBreadcrumbItem[] {
  return path.map((crumb, index) => {
    const prevHeadingPath = path
      .slice(0, index)
      .map((h) => slugify(h.text, { lower: true, strict: true }))
      .join('>')

    const url = new URL(`${window.location.origin}/${docSlug}`)
    url.searchParams.set('h', prevHeadingPath)
    url.searchParams.set('id', crumb.id)

    return {
      ...crumb,
      slug: slugify(crumb.text),
      url: url.href
    }
  })
}

/** Returns breadcrumb items when the heading exists in the doc; otherwise null. */
export function resolveHeadingBreadcrumbs(
  editor: Editor,
  headingId: string,
  docSlug: string
): HeadingBreadcrumbItem[] | null {
  const path = buildHeadingPath(editor, headingId)
  if (path.length === 0) return null
  return buildHeadingBreadcrumbItems(path, docSlug)
}
