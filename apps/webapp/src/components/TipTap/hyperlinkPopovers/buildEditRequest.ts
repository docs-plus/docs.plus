import type { EditHyperlinkOptions } from '@docs.plus/extension-hyperlink'

import { applyEdit } from './commands/applyEdit'
import { handleEditBack } from './handleEditBack'
import { getHyperlinkDisplayText, storedHrefOf } from './linkMarkUtils'
import type { ApplyHyperlinkArgs } from './types'

/** The pad Edit form fields. Read the stored href once at open: it fills URL and guards Apply. */
export const buildEditRequest = (opts: EditHyperlinkOptions) => {
  const expectedHref = storedHrefOf(opts)
  return {
    mode: 'edit' as const,
    editor: opts.editor,
    initialHref: expectedHref ?? '',
    initialText: getHyperlinkDisplayText(opts.editor, {
      nodePos: opts.nodePos,
      link: opts.link,
      href: expectedHref,
      markName: opts.markName
    }),
    validate: opts.validate,
    apply: (result: ApplyHyperlinkArgs) => applyEdit({ ...opts, expectedHref }, result),
    onBack: () => handleEditBack(opts)
  }
}
