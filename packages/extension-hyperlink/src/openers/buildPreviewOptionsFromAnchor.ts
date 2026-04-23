// Recover `PreviewHyperlinkOptions` from a live `<a>` DOM node. Used by
// the prebuilt edit popover's Back button and by BYO `editHyperlink`
// factories that hand off to `openPreviewHyperlink` — both need the
// same one-shot lookup (posAtDOM → mark.attrs) and a defensible
// fallback when the mark cannot be located.

import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import type { PreviewHyperlinkOptions } from '../hyperlink'

export interface BuildPreviewOptionsFromAnchorArgs {
  editor: Editor
  link: HTMLAnchorElement
  /** Forwarded onto the returned options; usually the configured `validate` option. */
  validate?: (url: string) => boolean
  /** Mark name to look up; defaults to `'hyperlink'`. Override only if the schema mark was renamed. */
  markName?: string
}

/**
 * Build `PreviewHyperlinkOptions` for `link` by reading the hyperlink
 * mark at the live ProseMirror position. When the mark cannot be found
 * (DOM detached, foreign anchor, schema mismatch), falls back to a
 * minimal `attrs` shape derived from `link.getAttribute('href')` so the
 * preview popover still has a stable `attrs.href` to render.
 *
 * The DOM `link.href` property is intentionally NOT used as a fallback
 * — it resolves relative hrefs against `document.baseURI`, which would
 * leak the host origin into a stored attribute.
 */
export function buildPreviewOptionsFromAnchor({
  editor,
  link,
  validate,
  markName = HYPERLINK_MARK_NAME
}: BuildPreviewOptionsFromAnchorArgs): PreviewHyperlinkOptions {
  const view = editor.view
  const nodePos = view.posAtDOM(link, 0)
  const node = view.state.doc.nodeAt(nodePos)
  const mark = node?.marks.find((m) => m.type.name === markName)
  const attrs = (mark?.attrs ?? {
    href: link.getAttribute('href'),
    target: null,
    rel: null,
    class: null,
    title: null,
    image: null
  }) as PreviewHyperlinkOptions['attrs']
  return { editor, link, nodePos, attrs, validate }
}
