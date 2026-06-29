const SOUNDCLOUD_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\/sets)?(\/[A-Za-z0-9_-]+)?(\/?)?(\?[A-Za-z0-9_=&-]+)?$/

export const SOUNDCLOUD_URL_REGEX = SOUNDCLOUD_URL_PATTERN
export const SOUNDCLOUD_URL_REGEX_GLOBAL = new RegExp(SOUNDCLOUD_URL_PATTERN.source, 'g')

export function isValidSoundCloudUrl(url: string): boolean {
  return SOUNDCLOUD_URL_REGEX.test(url)
}
