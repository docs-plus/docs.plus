import {
  buildPreviewOptionsFromAnchor,
  type EditHyperlinkOptions,
  openPreviewHyperlink
} from '@docs.plus/extension-hyperlink'

/**
 * Caller `onBack` wins; otherwise rebuild the preview from the live `<a>` and hand back.
 * Mirrors the prebuilt edit popover's Back, so `nodePos` and `markName` travel too.
 */
export const handleEditBack = (opts: EditHyperlinkOptions): void => {
  if (opts.onBack) {
    opts.onBack()
    return
  }
  openPreviewHyperlink(
    buildPreviewOptionsFromAnchor({
      editor: opts.editor,
      link: opts.link,
      nodePos: opts.nodePos,
      markName: opts.markName,
      validate: opts.validate,
      isAllowedUri: opts.isAllowedUri
    })
  )
}
