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
export { isImageUrl } from './nodes/image/helper'
export { isValidLoomUrl } from './nodes/loom/helper'
export { isValidSoundCloudUrl } from './nodes/soundcloud/helper'
export { isValidVimeoUrl } from './nodes/vimeo/helper'
export {
  buildXOEmbedParams,
  resolveXEmbedSizeId,
  X_EMBED_DEFAULT_MAXWIDTH,
  X_EMBED_SIZE_OPTIONS,
  X_EMBED_THEME_OPTIONS,
  type XEmbedSizeId,
  type XEmbedTheme
} from './nodes/x/embedOptions'
export { isValidXUrl } from './nodes/x/helper'
export { isValidYoutubeUrl, parseYoutubeVideoId } from './nodes/youtube/helper'
export {
  attachTooltip,
  canViewOriginal,
  closeMediaToolbar,
  closeToolbarPopover,
  composeMediaActions,
  copyMediaNode,
  createMediaToolbar,
  createReplaceUrlPopover,
  downloadMedia,
  hideTooltip,
  isDownloadable,
  layoutMediaActions,
  type MediaAction,
  type MediaActionAnchor,
  type MediaActionContext,
  type MediaActionList,
  type MediaActionPlacement,
  type MediaActionsBuilder,
  type MediaActionsResolver,
  type MediaToolbarFactory,
  type MediaToolbarIconContext,
  type MediaToolbarIconKey,
  type MediaToolbarIconScope,
  type MediaToolbarIconsResolver,
  type MediaToolbarLayout,
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
export { detectMediaType, type MediaNodeType } from './utils/detectMediaType'
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
export { isAudioUrl, isVideoUrl } from './utils/mediaUrl'

import { HyperMultimediaKit } from './hyperMultimediaKit'

export default {
  HyperMultimediaKit
}
