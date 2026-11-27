import {
  buildPreviewOptionsFromAnchor,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

import type { DocSelectionRange } from './types'

/** Display host without `www.`; `''` when the URL does not parse. */
export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * The raw `mark.attrs.href` of the live link, read when the edit form opens. Never a
 * normalized or rendered form: `renderHTML` blanks an unsafe href, and `google.com` stays as typed.
 */
export const storedHrefOf = (opts: EditHyperlinkOptions): string | undefined => {
  if (opts.editor.isDestroyed) return undefined
  return (
    buildPreviewOptionsFromAnchor({
      editor: opts.editor,
      link: opts.link,
      nodePos: opts.nodePos,
      markName: opts.markName
    }).attrs.href ?? undefined
  )
}

/**
 * Resolves a link's live document position through its connected (or recreated equivalent) `<a>`,
 * falling back to `nodePos`. The live DOM node moves with a co-editor's edits above it; a stored
 * `nodePos` does not (#643, #696).
 */
export const resolveLiveLinkPos = (
  editor: Editor,
  at: { link?: HTMLAnchorElement; nodePos?: number; markName?: string }
): number | undefined => {
  if (editor.isDestroyed) return undefined
  if (at.link) {
    const { nodePos } = buildPreviewOptionsFromAnchor({
      editor,
      link: at.link,
      nodePos: at.nodePos,
      markName: at.markName
    })
    return nodePos >= 0 ? nodePos : undefined
  }
  return typeof at.nodePos === 'number' && at.nodePos >= 0 ? at.nodePos : undefined
}

/**
 * Link text from the document. The live <a> wins over a stale nodePos; the href match stops a neighbour's text.
 * DOM text is the last resort. Keep the body equal to the extension's internal copy; change both together.
 */
export const getHyperlinkDisplayText = (
  editor: Editor,
  at: { nodePos?: number; link?: HTMLAnchorElement; href?: string | null; markName?: string }
): string => {
  const { link, markName = 'hyperlink' } = at
  const fallback = () => link?.innerText ?? link?.textContent ?? ''
  if (editor.isDestroyed) return fallback()
  const type = editor.schema.marks[markName]
  const { doc } = editor.state
  let live = -1
  try {
    if (link?.isConnected) live = editor.view.posAtDOM(link, 0)
  } catch {
    // An <a> outside this view gives -1, and live >= 0 handles that. This catch is only a guard.
  }
  const pos = live >= 0 ? live : at.nodePos
  if (!type || typeof pos !== 'number' || pos < 0 || pos > doc.content.size) return fallback()
  const href = at.href ?? link?.getAttribute('href')
  // href picks the mark; its full attrs then give the same range Apply edits.
  const $pos = doc.resolve(pos)
  const mark = [$pos.nodeAfter, $pos.nodeBefore]
    .flatMap((n) => n?.marks ?? [])
    .find((m) => m.type === type && (!href || m.attrs.href === href))
  const range = mark && getMarkRange($pos, type, mark.attrs)
  return range ? doc.textBetween(range.from, range.to, '') : fallback()
}

export const isValidDocRange = (docSize: number, from: number, to: number) =>
  from >= 0 && to <= docSize && from < to

export function resolveDocSelection(
  editor: Editor,
  snap: DocSelectionRange | null | undefined
): DocSelectionRange | undefined {
  const { from, to, empty } = editor.state.selection
  const docSize = editor.state.doc.content.size
  if (!empty && isValidDocRange(docSize, from, to)) return { from, to }
  if (snap && isValidDocRange(docSize, snap.from, snap.to)) return snap
  return undefined
}
