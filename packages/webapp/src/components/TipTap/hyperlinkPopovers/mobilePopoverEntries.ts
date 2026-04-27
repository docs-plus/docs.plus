import {
  buildPreviewOptionsFromAnchor,
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions,
  openPreviewHyperlink
} from '@docs.plus/extension-hyperlink'
import { useSheetStore } from '@stores'

import { applyCreate } from './commands/applyCreate'
import { applyEdit } from './commands/applyEdit'

/** Caller `onBack` wins; otherwise rebuild the preview popover from the live `<a>` and hand back. Mirrors the prebuilt edit popover's Back without touching the package's private stash. */
const handleEditBack = (opts: EditHyperlinkOptions): void => {
  if (opts.onBack) {
    opts.onBack()
    return
  }
  openPreviewHyperlink(
    opts.editor,
    buildPreviewOptionsFromAnchor({
      editor: opts.editor,
      link: opts.link,
      validate: opts.validate,
      isAllowedUri: opts.isAllowedUri
    })
  )
}

/** Mobile adapter for `popovers.createHyperlink`. Returning `null` skips the extension's floating shell so we render through `react-modal-sheet`. */
export function createHyperlinkMobile(opts: CreateHyperlinkOptions): HTMLElement | null {
  const initialHref = typeof opts.attributes?.href === 'string' ? opts.attributes.href : ''
  useSheetStore.getState().openSheet('linkEditor', {
    mode: 'create',
    editor: opts.editor,
    initialHref,
    validate: opts.validate,
    onSubmit: (result) => applyCreate(opts, result)
  })
  return null
}

/** Mobile adapter for `popovers.editHyperlink`. Returns `null` so the extension skips its DOM popover. */
export function editHyperlinkMobile(opts: EditHyperlinkOptions): HTMLElement | null {
  useSheetStore.getState().openSheet('linkEditor', {
    mode: 'edit',
    editor: opts.editor,
    initialHref: opts.link.getAttribute('href') ?? '',
    initialText: opts.link.innerText ?? opts.link.textContent ?? '',
    validate: opts.validate,
    onSubmit: (result) => applyEdit(opts, result),
    onBack: () => handleEditBack(opts)
  })
  return null
}
