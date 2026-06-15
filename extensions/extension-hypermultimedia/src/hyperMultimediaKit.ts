import { Extension } from '@tiptap/core'

import { MediaResizeControls } from './extensions/mediaResizeControls'
import { MediaResizeGripper } from './extensions/resizeGripper'
import { HYPER_MULTIMEDIA_KIT_EXTENSION_NAME } from './kitStorage'
import type { MediaLoadingShellOption } from './loading'
import { Audio, AudioOptions } from './nodes/audio/audio'
import { Image } from './nodes/image/image'
import { Loom, LoomOptions } from './nodes/loom/loom'
import { SoundCloud, SoundCloudOptions } from './nodes/soundcloud/soundcloud'
import { Video, VideoOptions } from './nodes/video/video'
import { Vimeo, VimeoOptions } from './nodes/vimeo/vimeo'
import { X, XOptions } from './nodes/x/x'
import { Youtube, YoutubeOptions } from './nodes/youtube/youtube'
import type { ReplaceUrlPopoverFactory } from './toolbar/replaceUrl'
import type { MediaActionContext, MediaActionsResolver, MediaToolbarFactory } from './toolbar/types'
import type { ImageOptions } from './types'

export interface HyperMultimediaKitOptions {
  Image: Partial<ImageOptions & { resizeGripper?: boolean }> | true | false
  Audio: Partial<AudioOptions & { resizeGripper?: boolean }> | true | false
  Video: Partial<VideoOptions & { resizeGripper?: boolean }> | true | false
  Youtube: Partial<YoutubeOptions & { resizeGripper?: boolean }> | true | false
  Vimeo: Partial<VimeoOptions & { resizeGripper?: boolean }> | true | false
  SoundCloud: Partial<SoundCloudOptions & { resizeGripper?: boolean }> | true | false
  Loom: Partial<LoomOptions & { resizeGripper?: boolean }> | true | false
  X: Partial<XOptions> | true | false
  /**
   * Host-agnostic toolbar slot. Return an element for the desktop floating
   * toolbar or `null` to opt out so the host renders its own surface (mobile
   * sheet). Omit to use the built-in `createMediaToolbar`.
   */
  mediaToolbar?: MediaToolbarFactory
  /**
   * Loading overlay while remote media / embeds resolve. `true` = built-in
   * shimmer shell; `false` = off; pass a factory to replace the overlay UI only.
   */
  loadingShell?: MediaLoadingShellOption
  /** Customize/extend/reorder the built-in toolbar actions per node. */
  mediaActions?: MediaActionsResolver
  /**
   * Replace-URL popover slot. Return the popover content for the node-anchored
   * dialog, or `null` to opt out so the host renders its own surface (mobile
   * sheet). Omit to use the built-in URL editor.
   */
  replaceUrlPopover?: ReplaceUrlPopoverFactory
  /** Return true for host-uploaded assets so "View original" is hidden (image/video/audio). */
  isUploadedMedia?: (ctx: MediaActionContext) => boolean
}

type MediaExtension =
  | typeof Image
  | typeof Video
  | typeof Audio
  | typeof Youtube
  | typeof Vimeo
  | typeof SoundCloud
  | typeof Loom
  | typeof X

export const HyperMultimediaKit = Extension.create<HyperMultimediaKitOptions>({
  name: HYPER_MULTIMEDIA_KIT_EXTENSION_NAME,

  // Expose the host-agnostic toolbar factory on per-editor storage so
  // `openMediaToolbar` (called from every node-view) can resolve it without
  // threading the option through each node. A host wires a mobile-sheet
  // factory here; absent, the built-in desktop toolbar is used.
  addStorage() {
    return {
      mediaToolbar: this.options.mediaToolbar,
      loadingShell: this.options.loadingShell ?? true,
      mediaActions: this.options.mediaActions,
      replaceUrlPopover: this.options.replaceUrlPopover,
      isUploadedMedia: this.options.isUploadedMedia
    }
  },

  addExtensions() {
    const extensions = []
    const resizableMedia: string[] = []
    const mediaNodeNames: string[] = []
    let hasMediaNodes = false

    const addMediaExtension = (media: MediaExtension, mediaOptions: any) => {
      if (mediaOptions !== false) {
        hasMediaNodes = true
        mediaNodeNames.push(media.name)
        extensions.push(media.configure(mediaOptions))

        // X embeds use oEmbed maxwidth presets in the toolbar, not drag handles.
        if (mediaOptions?.resizeGripper !== false && media.name !== 'x') {
          resizableMedia.push(media.name)
        }
      }
    }

    addMediaExtension(Image, this.options.Image)
    addMediaExtension(Video, this.options.Video)
    addMediaExtension(Audio, this.options.Audio)
    addMediaExtension(Youtube, this.options.Youtube)
    addMediaExtension(Vimeo, this.options.Vimeo)
    addMediaExtension(SoundCloud, this.options.SoundCloud)
    addMediaExtension(Loom, this.options.Loom)
    addMediaExtension(X, this.options.X)

    if (hasMediaNodes) {
      if (resizableMedia.length > 0) {
        extensions.push(
          MediaResizeGripper.configure({
            acceptedNodes: resizableMedia
          })
        )
      }
      extensions.push(
        MediaResizeControls.configure({
          trackedNodes: mediaNodeNames
        })
      )
    }

    return extensions
  }
})
