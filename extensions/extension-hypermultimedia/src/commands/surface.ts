// The single place the HyperMultimedia nodes' public commands are declared,
// augmenting `@tiptap/core`'s `Commands`. Each command's option type is imported
// from its own node so this surface stays truthful instead of a parallel copy.

import type { SetAudioOptions } from '../nodes/audio/audio'
import type { SetLoomOptions } from '../nodes/loom/loom'
import type { SetSoundCloudOptions } from '../nodes/soundcloud/soundcloud'
import type { SetSpotifyOptions } from '../nodes/spotify/spotify'
import type { SetVideoOptions } from '../nodes/video/video'
import type { SetVimeoOptions } from '../nodes/vimeo/vimeo'
import type { AddXOptions } from '../nodes/x/x'
import type { SetYoutubeVideoOptions } from '../nodes/youtube/youtube'
import type { SetImageOptions, UpdateImageDimensionsParams } from '../types'

/** Every public command the media nodes contribute, in one place. */
export interface MediaPublicCommands<ReturnType> {
  /** Insert an image node; mints a fresh `keyId` per insert. */
  setImage: (options: SetImageOptions) => ReturnType
  /** Set the `width` / `height` attributes of an existing image by `keyId`. */
  updateImageDimensions: (options: UpdateImageDimensionsParams) => ReturnType
  /** Insert a `<video>` node; returns `false` without a `src`. */
  setVideo: (options: SetVideoOptions) => ReturnType
  /** Insert an `<audio>` node; returns `false` without a `src`. */
  setAudio: (options: SetAudioOptions) => ReturnType
  /** Insert a YouTube embed; returns `false` for an invalid URL. */
  setYoutubeVideo: (options: SetYoutubeVideoOptions) => ReturnType
  /** Insert a Vimeo embed; returns `false` for an invalid URL. */
  setVimeo: (options: SetVimeoOptions) => ReturnType
  /** Insert a SoundCloud embed; returns `false` for an invalid URL. */
  setSoundCloud: (options: SetSoundCloudOptions) => ReturnType
  /** Insert a Spotify embed; returns `false` for an invalid URL. */
  setSpotify: (options: SetSpotifyOptions) => ReturnType
  /** Insert an X embed; returns `false` for an invalid URL. */
  setX: (options: AddXOptions) => ReturnType
  /** Insert a Loom embed; returns `false` for an invalid URL. */
  setLoom: (options: SetLoomOptions) => ReturnType
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    media: MediaPublicCommands<ReturnType>
  }
}
