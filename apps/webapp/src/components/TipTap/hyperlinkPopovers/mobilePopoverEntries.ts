import {
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore } from '@stores'

import { applyCreate } from './commands/applyCreate'
import { applyEdit } from './commands/applyEdit'
import { handleEditBack } from './handleEditBack'
import { getHyperlinkDisplayText, storedHrefOf } from './linkMarkUtils'

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
  const expectedHref = storedHrefOf(opts)
  useSheetStore.getState().openSheet('linkEditor', {
    mode: 'edit',
    editor: opts.editor,
    initialHref: opts.link.getAttribute('href') ?? '',
    initialText: getHyperlinkDisplayText(opts.editor, {
      nodePos: opts.nodePos,
      link: opts.link,
      markName: opts.markName
    }),
    validate: opts.validate,
    onSubmit: (result) => applyEdit({ ...opts, expectedHref }, result),
    onBack: () => handleEditBack(opts)
  })
  return null
}
