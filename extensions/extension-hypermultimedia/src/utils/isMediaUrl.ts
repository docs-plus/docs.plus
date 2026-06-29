import { isImageUrl } from '../nodes/image/helper'
import { isValidLoomUrl } from '../nodes/loom/helper'
import { isValidSoundCloudUrl } from '../nodes/soundcloud/helper'
import { isValidSpotifyUrl } from '../nodes/spotify/helper'
import { isValidVimeoUrl } from '../nodes/vimeo/helper'
import { isValidXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'

/**
 * True if `url` is one this kit auto-converts to a media node on paste.
 * A host running a link extension alongside it should veto these so media
 * URLs become nodes, not links: `Hyperlink.configure({ shouldAutoLink: (url)
 * => !isMediaUrl(url) })`. Resolves the paste precedence between the two.
 */
// Deliberately excludes raw video/audio URLs (unlike detectMediaType) so pasted
// `.mp4`/`.mp3` links stay links, not nodes.
export const isMediaUrl = (url: string): boolean =>
  isImageUrl(url) ||
  isValidYoutubeUrl(url) ||
  isValidVimeoUrl(url) ||
  isValidSoundCloudUrl(url) ||
  isValidSpotifyUrl(url) ||
  isValidLoomUrl(url) ||
  isValidXUrl(url)
