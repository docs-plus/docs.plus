import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import { findLiveEquivalentAnchor } from './liveAnchor'

export interface BuildPreviewOptionsFromAnchorArgs {
  editor: Editor
  link: HTMLAnchorElement
  /** Prefer this ProseMirror position before falling back to DOM similarity. */
  nodePos?: number
  /** Forwarded onto the returned options; usually the configured `validate` option. */
  validate?: (url: string) => boolean
  /** Preserve the host's composed navigation gate when rebuilding preview from edit/back. */
  isAllowedUri?: (uri: string) => boolean
  /** Mark name to look up; defaults to `'hyperlink'`. Override only if the schema mark was renamed. */
  markName?: string
}

/**
 * Exists so the edit popover's Back button and BYO `editHyperlink` factories
 * share one `posAtDOM → mark.attrs` lookup. The DOM `link.href` property is
 * never the raw-href fallback — it resolves relative hrefs against
 * `document.baseURI`, leaking the host origin into a stored attribute.
 */
export function buildPreviewOptionsFromAnchor({
  editor,
  link,
  nodePos: preferredNodePos,
  validate,
  isAllowedUri,
  markName = HYPERLINK_MARK_NAME
}: BuildPreviewOptionsFromAnchorArgs): PreviewHyperlinkOptions {
  const view = editor.view
  const liveLink = findLiveEquivalentAnchor(editor, link, preferredNodePos) ?? link
  let nodePos = preferredNodePos ?? -1
  let node: ReturnType<typeof view.state.doc.nodeAt> | null = null
  try {
    nodePos = view.posAtDOM(liveLink, 0)
    if (nodePos >= 0) node = view.state.doc.nodeAt(nodePos)
  } catch {
    node = null
  }
  const mark = node?.marks.find((m) => m.type.name === markName)
  const attrs = (mark?.attrs ?? {
    href: liveLink.getAttribute('href'),
    target: null,
    rel: null,
    class: null,
    title: null,
    image: null
  }) as PreviewHyperlinkOptions['attrs']
  return { editor, link: liveLink, nodePos, attrs, validate, isAllowedUri }
}
