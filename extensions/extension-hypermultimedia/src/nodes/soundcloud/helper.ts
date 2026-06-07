export const SOUNDCLOUD_URL_REGEX =
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\/sets)?(\/[A-Za-z0-9_-]+)?(\/?)?(\?[A-Za-z0-9_=&-]+)?$/
export const SOUNDCLOUD_URL_REGEX_GLOBAL =
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\/sets)?(\/[A-Za-z0-9_-]+)?(\/?)?(\?[A-Za-z0-9_=&-]+)?$/g

export const isValidSoundCloudUrl = (url: string): boolean => SOUNDCLOUD_URL_REGEX.test(url)

export {
  buildSoundCloudEmbedUrl,
  resolveSoundCloudIframeAttributes,
  resolveSoundCloudVisual,
  SOUNDCLOUD_PLAYER_KIT_DEFAULTS,
  type SoundCloudPlayerKitOptions
} from './embedOptions'
