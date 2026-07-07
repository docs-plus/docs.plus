import { parseVimeoVideoRef } from './embedOptions'

// Optional [/?#] tail keeps unlisted-video `?h=` params in the match; the (?=\s|$)
// boundary stops partial-ID claims like vimeo.com/123abc matching as /123.
export const VIMEO_REGEX_GLOBAL =
  /https?:\/\/(www\.)?(vimeo\.com\/\d+|player\.vimeo\.com\/video\/\d+)(?:[/?#][^\s]*)?(?=\s|$)/g

export const isValidVimeoUrl = (url: string): boolean => parseVimeoVideoRef(url) !== null

export {
  buildVimeoEmbedUrl,
  parseVimeoVideoRef,
  VIMEO_EMBED_ATTR_KEYS,
  VIMEO_PLAYER_KIT_DEFAULTS,
  type VimeoBylinePortrait,
  type VimeoPlayerKitOptions,
  type VimeoQuality
} from './embedOptions'
