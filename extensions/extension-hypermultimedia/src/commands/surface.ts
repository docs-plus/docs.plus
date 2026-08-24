import type { SetAudioOptions } from '../nodes/audio/audio'
import type { SetImageOptions, UpdateImageDimensionsParams } from '../nodes/image/types'
import type { SetLoomOptions } from '../nodes/loom/loom'
import type { SetSoundCloudOptions } from '../nodes/soundcloud/soundcloud'
import type { SetSpotifyOptions } from '../nodes/spotify/spotify'
import type { SetVideoOptions } from '../nodes/video/video'
import type { SetVimeoOptions } from '../nodes/vimeo/vimeo'
import type { AddXOptions } from '../nodes/x/x'
import type { SetYoutubeVideoOptions } from '../nodes/youtube/youtube'

export interface MediaPublicCommands<ReturnType> {
  setImage: (options: SetImageOptions) => ReturnType
  updateImageDimensions: (options: UpdateImageDimensionsParams) => ReturnType
  setVideo: (options: SetVideoOptions) => ReturnType
  setAudio: (options: SetAudioOptions) => ReturnType
  setYoutubeVideo: (options: SetYoutubeVideoOptions) => ReturnType
  setVimeo: (options: SetVimeoOptions) => ReturnType
  setSoundCloud: (options: SetSoundCloudOptions) => ReturnType
  setSpotify: (options: SetSpotifyOptions) => ReturnType
  setX: (options: AddXOptions) => ReturnType
  setLoom: (options: SetLoomOptions) => ReturnType
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    media: MediaPublicCommands<ReturnType>
  }
}
