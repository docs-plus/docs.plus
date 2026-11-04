// TipTap adapter → chatroom store, same boundary as pad `mobilePopoverEntries` →
// `useSheetStore`. Extension stays host-agnostic; composer owns the modal UI.
import { useComposerLinkDialogStore } from '@components/chatroom/components/MessageComposer/stores/composerLinkDialogStore'
import { resolveComposerCreateSelection } from '@components/chatroom/components/MessageComposer/stores/composerLinkSelectionRef'
import {
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

import { buildEditRequest } from './buildEditRequest'

export function previewComposerHyperlink(options: PreviewHyperlinkOptions): HTMLElement | null {
  const { link, editor, nodePos, attrs } = options
  const href = attrs.href ?? link.getAttribute('href') ?? ''
  useComposerLinkDialogStore.getState().openPreview({
    href,
    editor,
    nodePos,
    validate: options.validate
  })
  return null
}

export function createHyperlinkComposerMobile(opts: CreateHyperlinkOptions): HTMLElement | null {
  const { editor, extensionName, attributes, validate } = opts
  const initialHref = typeof attributes?.href === 'string' ? attributes.href : ''
  const selection = resolveComposerCreateSelection(editor)
  const initialText = selection
    ? editor.state.doc.textBetween(selection.from, selection.to, '\n').trim()
    : ''

  useComposerLinkDialogStore.getState().openCreate({
    editor,
    extensionName,
    attributes: attributes ?? {},
    validate,
    initialHref,
    initialText,
    selection
  })
  return null
}

export function editHyperlinkComposerMobile(opts: EditHyperlinkOptions): HTMLElement | null {
  const nodePos = opts.nodePos
  if (nodePos == null) {
    console.warn('[composerMobilePopoverEntries] editHyperlinkComposerMobile: missing nodePos')
    return null
  }
  const { initialHref, initialText } = buildEditRequest(opts)
  useComposerLinkDialogStore.getState().openEdit({
    editor: opts.editor,
    nodePos,
    validate: opts.validate,
    initialHref,
    initialText
  })
  return null
}
