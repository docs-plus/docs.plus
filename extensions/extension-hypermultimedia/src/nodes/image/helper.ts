// Bang is required so plain `[text](url)` links stay text. No `g` flag: input
// rules reuse the regex across keystrokes, and a sticky lastIndex makes matches flaky.
export const inputRegex =
  /(?:^|\s)(!\[([^\]]*)\]\(((?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl)(?:\?.*)?(?:#.*)?)\))$/i

const httpImageUrlRegex =
  /^(?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl)(?:\?.*)?(?:#.*)?$/i

export const isImageUrl = (url: string): boolean => {
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('blob:')) return true
  return httpImageUrlRegex.test(url)
}

const absoluteHttpRegex = /^(?:https?:)?\/\//i

/** The host of an absolute http(s) src, or null for inline, local and malformed ones. */
export const imageSourceHost = (src: string | null | undefined): string | null => {
  if (!src || !absoluteHttpRegex.test(src)) return null
  try {
    return new URL(src, 'https://invalid.local').hostname
  } catch {
    return null
  }
}

// An `<img>` already says it is an image, so any src we can name a host for counts,
// with or without a file extension (#637). Bare pasted text still needs one.
export const isImageElementSrc = (src: string): boolean =>
  isImageUrl(src) || imageSourceHost(src) !== null
