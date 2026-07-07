import { parseYoutubeVideoId } from './embedOptions'

export const YOUTUBE_REGEX_GLOBAL =
  /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)(?!.*\/channel\/)(?!\/@)(.+)?$/g

export const isValidYoutubeUrl = (url: string): boolean => parseYoutubeVideoId(url) !== null

export {
  buildYoutubeEmbedUrl,
  getYoutubeEmbedHost,
  parseYoutubeStartSeconds,
  parseYoutubeVideoId,
  YOUTUBE_EMBED_ATTR_KEYS,
  YOUTUBE_PLAYER_KIT_DEFAULTS,
  type YoutubeEmbedColor,
  type YoutubeListType,
  type YoutubePlayerKitOptions
} from './embedOptions'
