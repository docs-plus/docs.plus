import type { DocSelectionRange } from '@components/TipTap/hyperlinkPopovers/types'
import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

export type ComposerLinkPhase = 'idle' | 'preview' | 'create' | 'edit'

export type ComposerLinkPreviewPayload = {
  href: string
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
}

export type ComposerLinkCreatePayload = {
  editor: Editor
  extensionName: string
  attributes: Partial<HyperlinkAttributes>
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  selection?: DocSelectionRange
}

export type ComposerLinkEditPayload = {
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  returnToPreview?: ComposerLinkPreviewPayload
}
