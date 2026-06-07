export const LOOM_REGEX = /https?:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+(?:\?[^\s]*)?/
export const LOOM_REGEX_GLOBAL =
  /https?:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+(?:\?[^\s]*)?/g

export const isValidLoomUrl = (url: string): boolean => LOOM_REGEX.test(url)

export const getLoomVideoId = (url: string | null | undefined): string | null => {
  if (!url) return null
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

/** Normalize any Loom share/embed URL to the canonical embed form (id only). */
export const getLoomEmbedUrl = (url: string | null | undefined): string | null => {
  const id = getLoomVideoId(url)
  return id ? `https://www.loom.com/embed/${id}` : null
}

export {
  buildLoomEmbedUrl,
  LOOM_EMBED_ATTR_KEYS,
  LOOM_EMBED_KIT_DEFAULTS,
  type LoomEmbedKitOptions
} from './embedOptions'
