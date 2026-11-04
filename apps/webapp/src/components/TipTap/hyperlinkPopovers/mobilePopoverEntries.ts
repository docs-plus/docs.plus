import {
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore } from '@stores'

import { buildEditRequest } from './buildEditRequest'
import { applyCreate } from './commands/applyCreate'

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
  const { apply, ...request } = buildEditRequest(opts)
  useSheetStore.getState().openSheet('linkEditor', { ...request, onSubmit: apply })
  return null
}
