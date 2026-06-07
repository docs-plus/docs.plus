import { parseVimeoVideoRef } from './embedOptions'

export const VIMEO_REGEX =
  /https?:\/\/(www\.)?(vimeo\.com\/\d+|player\.vimeo\.com\/video\/\d+)(?:$|\/|\?|#)/
export const VIMEO_REGEX_GLOBAL =
  /https?:\/\/(www\.)?(vimeo\.com\/\d+|player\.vimeo\.com\/video\/\d+)(?:$|\/|\?|#)/g

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
