import { isImageUrl } from '../nodes/image/helper'
import { isValidLoomUrl } from '../nodes/loom/helper'
import { isValidSoundCloudUrl } from '../nodes/soundcloud/helper'
import { isValidVimeoUrl } from '../nodes/vimeo/helper'
import { isValidXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'

/**
 * True if `url` is one this kit auto-converts to a media node on paste.
 * A host running a link extension alongside it should veto these so media
 * URLs become nodes, not links: `Hyperlink.configure({ shouldAutoLink: (url)
 * => !isMediaUrl(url) })`. Resolves the paste precedence between the two.
 */
export const isMediaUrl = (url: string): boolean =>
  Boolean(
    isImageUrl(url) ||
    isValidYoutubeUrl(url) ||
    isValidVimeoUrl(url) ||
    isValidSoundCloudUrl(url) ||
    isValidLoomUrl(url) ||
    isValidXUrl(url)
  )
