import { isImageUrl } from '../nodes/image/helper'
import { isValidLoomUrl } from '../nodes/loom/helper'
import { isValidSoundCloudUrl } from '../nodes/soundcloud/helper'
import { isValidSpotifyUrl } from '../nodes/spotify/helper'
import { isValidVimeoUrl } from '../nodes/vimeo/helper'
import { isValidXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'
import { isAudioUrl, isVideoUrl } from './mediaUrl'

/** Every media node `.name`, the source of truth for which node a URL inserts. */
export type MediaNodeType =
  | 'image'
  | 'video'
  | 'audio'
  | 'youtube'
  | 'vimeo'
  | 'soundcloud'
  | 'spotify'
  | 'loom'
  | 'x'

/**
 * Resolve a URL to the media node that should render it, or null when none does.
 * Specific providers and image win before the generic video/audio extension
 * matchers, so a `youtube.com/...webm` URL maps to youtube, not video.
 */
export const detectMediaType = (url: string): MediaNodeType | null => {
  if (isValidYoutubeUrl(url)) return 'youtube'
  if (isValidVimeoUrl(url)) return 'vimeo'
  if (isValidSoundCloudUrl(url)) return 'soundcloud'
  if (isValidSpotifyUrl(url)) return 'spotify'
  if (isValidLoomUrl(url)) return 'loom'
  if (isValidXUrl(url)) return 'x'
  if (isImageUrl(url)) return 'image'
  if (isVideoUrl(url)) return 'video'
  if (isAudioUrl(url)) return 'audio'
  return null
}
