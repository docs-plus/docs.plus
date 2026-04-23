import type { CreateHyperlinkOptions } from '@docs.plus/extension-hyperlink'
import { useSheetStore } from '@stores'

/**
 * Mobile adapter for the extension's `popovers.createHyperlink` contract.
 *
 * Opens the React `linkEditor` bottom sheet via the global sheet store
 * and returns `null`. The Tiptap extension treats `null` as "no
 * popover" and exits cleanly (see hyperlink.ts setHyperlink command),
 * so the floating-popover machinery is bypassed entirely on mobile and
 * the sheet renders through the same react-modal-sheet pipeline as
 * every other mobile sheet in the app.
 */
export default function createHyperlink(options: CreateHyperlinkOptions): HTMLElement | null {
  const { editor, extensionName, attributes, validate } = options
  const initialHref = typeof attributes?.href === 'string' && attributes.href ? attributes.href : ''

  useSheetStore.getState().openSheet('linkEditor', {
    mode: 'create',
    initialHref,
    validate,
    onSubmit: (href) => {
      editor
        .chain()
        .setMark(extensionName, { ...attributes, href })
        .setMeta('preventAutolink', true)
        .run()
    }
  })

  return null
}
