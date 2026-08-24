import type { Editor } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'

import type { HyperlinkOptions, PreviewHyperlinkOptions } from '../hyperlink'
import type { URLDecisions } from '../url-decisions'

export interface LinkContext {
  type: MarkType
  editor: Editor
  /** One URL Decisions pipeline per editor (cached on `storage.context`). */
  urls: URLDecisions
  options: HyperlinkOptions
  validate?: (url: string) => boolean
  /** Preview popover factory, or `null` when the host opted out. */
  previewPopover: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
}
