import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME, SAFE_WINDOW_FEATURES } from '../constants'
import type { HyperlinkStorage } from '../hyperlink'
import type { LinkContext } from './types'

const defaultNavigate = (href: string): void => {
  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}

/**
 * The one place the extension opens a link. The composed read gate runs first,
 * so a host `navigate` never sees an href the gate refuses.
 */
export function openLink(linkCtx: LinkContext, href: string, opts: { newTab: boolean }): boolean {
  if (!linkCtx.urls.forRead(href).navigable) return false
  const navigate = linkCtx.options.navigate ?? defaultNavigate
  navigate(href, { newTab: opts.newTab })
  return true
}

/** For surfaces that hold only the editor, such as the prebuilt preview popover. */
export function getLinkContext(editor: Editor): LinkContext | null {
  const storage = (editor.storage as unknown as Record<string, HyperlinkStorage | undefined>)[
    HYPERLINK_MARK_NAME
  ]
  return storage?.context ?? null
}
