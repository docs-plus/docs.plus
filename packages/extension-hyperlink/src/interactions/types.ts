// Shared types for the Hyperlink interaction layer.
// `LinkContext` is the single deps bag every interaction reads.

import type { Editor } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'

import type { HyperlinkOptions, PreviewHyperlinkOptions } from '../hyperlink'
import type { URLDecisions } from '../url-decisions'

/** Deps every interaction (input rule, paste rule, autolink, paste handler, click handler) reads. */
export interface LinkContext {
  type: MarkType
  editor: Editor
  /** URL Decisions pipeline; one per `createLinkContext` call (the extension allocates one per `add*` hook). */
  urls: URLDecisions
  options: HyperlinkOptions
  /** Convenience accessor for `options.validate`. */
  validate?: (url: string) => boolean
  /** Preview popover factory, or `null` when the host opted out. */
  previewPopover: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
}
