import { parseSpotifyEntity } from './embedOptions'

export const SPOTIFY_URL_REGEX =
  /^https?:\/\/(www\.)?open\.spotify\.com\/(embed\/)?(intl-[a-z-]+\/)?(track|album|playlist|artist|show|episode)\/[A-Za-z0-9]+(\?\S*)?$/i
export const SPOTIFY_URL_REGEX_GLOBAL = new RegExp(SPOTIFY_URL_REGEX.source, 'gi')

/** Matches a pasted Spotify "Copy embed" `<iframe>`; capture group 1 is the embed src. */
export const SPOTIFY_EMBED_IFRAME_REGEX =
  /<iframe[^>]*\bsrc=["']([^"']*open\.spotify\.com\/embed\/[^"']+)["'][^>]*>(?:\s*<\/iframe>)?/gi

/** True for any URL or `spotify:` URI that resolves to an embeddable entity. */
export const isValidSpotifyUrl = (url: string): boolean => parseSpotifyEntity(url) !== null

export {
  buildSpotifyEmbedUrl,
  canonicalSpotifyUrl,
  defaultSpotifyHeight,
  fitSpotifyLayoutToEditorColumn,
  parseSpotifyEntity,
  SPOTIFY_DEFAULT_WIDTH,
  SPOTIFY_EMBED_ATTR_KEYS,
  SPOTIFY_EMBED_KIT_DEFAULTS,
  SPOTIFY_ENTITY_TYPES,
  type SpotifyEmbedKitOptions,
  type SpotifyEntityType,
  type SpotifyTheme,
  syncSpotifyResponsiveHost
} from './embedOptions'
