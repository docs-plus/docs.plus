import {
  buildPreviewOptionsFromAnchor,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

import { applyEdit } from './commands/applyEdit'
import { handleEditBack } from './handleEditBack'
import { getHyperlinkDisplayText, storedHrefOf } from './linkMarkUtils'
import type { ApplyHyperlinkArgs } from './types'

/**
 * The live <a> moves with a co-editor's change above it, but the `nodePos` stored at open
 * does not. The selection cannot stand in: it need not sit on the link when the form opens.
 */
const livePosOf = (opts: EditHyperlinkOptions): number | undefined => {
  const { nodePos } = buildPreviewOptionsFromAnchor(opts)
  return nodePos >= 0 ? nodePos : undefined
}

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
    apply: (result: ApplyHyperlinkArgs) =>
      applyEdit({ ...opts, nodePos: livePosOf(opts), expectedHref }, result),
    onBack: () => handleEditBack(opts)
  }
}
