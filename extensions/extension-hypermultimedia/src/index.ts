// Re-exported so the `media` command augmentation in surface.ts lands in the
// bundled .d.ts (it is the single declaration point for every node's commands).
export type { MediaPublicCommands } from './commands/surface'
export * from './hyperMultimediaKit'
export {
  createDefaultMediaLoadingShell,
  type MediaLoadingBindLoadOptions,
  type MediaLoadingController,
  type MediaLoadingKind,
  type MediaLoadingShellContext,
  type MediaLoadingShellFactory,
  type MediaLoadingShellOption,
  type MediaLoadingShellWrapOptions,
  wrapMediaWithLoadingShell
} from './loading'
export {
  buildXOEmbedParams,
  resolveXEmbedSizeId,
  X_EMBED_DEFAULT_MAXWIDTH,
  X_EMBED_SIZE_OPTIONS,
  X_EMBED_THEME_OPTIONS,
  type XEmbedSizeId,
  type XEmbedTheme
} from './nodes/x/embedOptions'
export {
  attachTooltip,
  canViewOriginal,
  closeMediaToolbar,
  closeToolbarPopover,
  copyMediaNode,
  createMediaToolbar,
  createReplaceUrlPopover,
  downloadMedia,
  hideTooltip,
  isDownloadable,
  type MediaAction,
  type MediaActionContext,
  type MediaActionList,
  type MediaActionPlacement,
  type MediaActionsResolver,
  type MediaToolbarFactory,
  type MediaToolbarOptions,
  openMediaToolbar,
  openReplaceUrlPopover,
  openToolbarPopover,
  removeMediaNode,
  type ReplaceUrlPopoverFactory,
  type ReplaceUrlPopoverOptions,
  resolveMediaActions,
  viewOriginalMedia
} from './toolbar'
export {
  fitDimensionsToBounds,
  fitLayoutToEditorColumn,
  getEditorContentWidth
} from './utils/fitImageDimensions'
export { isMediaUrl } from './utils/isMediaUrl'
export { applyNodeAttributes } from './utils/media-node-attrs'
export {
  getCurrentMediaPlacement,
  getMediaPlacementAttrs,
  MEDIA_MARGIN_OPTIONS,
  MEDIA_PLACEMENT_OPTIONS,
  type MediaPlacementId
} from './utils/media-placement'
export { resolveMediaNodePos } from './utils/media-resize-controls'

import { HyperMultimediaKit } from './hyperMultimediaKit'

export default {
  HyperMultimediaKit
}
