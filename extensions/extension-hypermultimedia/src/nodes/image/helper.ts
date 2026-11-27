const IMAGE_EXTENSIONS = 'jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl'

// Bang is required so plain `[text](url)` links stay text. No `g` flag: input
// rules reuse the regex across keystrokes, and a sticky lastIndex makes matches flaky.
// Disjoint negated classes keep keystroke matching strictly linear.
export const inputRegex = new RegExp(
  `(?:^|\\s)(!\\[([^\\]]*)\\]\\(((?:https?:\\/\\/|\\/\\/)[^\\s)?#]+\\.(?:${IMAGE_EXTENSIONS})(?:\\?[^\\s)#]*)?(?:#[^\\s)]*)?)\\))$`,
  'i'
)

const absoluteHttpRegex = /^(?:https?:)?\/\//i
const imageExtensionRegex = new RegExp(`\\.(?:${IMAGE_EXTENSIONS})$`, 'i')
const inlineImageDataRegex = /^data:image\/(?!svg\+xml)/i

export const isImageUrl = (url: string): boolean => {
  if (inlineImageDataRegex.test(url)) return true
  if (url.startsWith('blob:')) return true
  if (!absoluteHttpRegex.test(url)) return false
  try {
    const parsed = new URL(url, 'https://invalid.local')
    return imageExtensionRegex.test(parsed.pathname)
  } catch {
    return false
  }
}

/** The host of an absolute http(s) src, or undefined for inline, local and malformed ones. */
export const imageSourceHost = (src: string | null | undefined): string | undefined => {
  if (!src || !absoluteHttpRegex.test(src)) return undefined
  try {
    return new URL(src, 'https://invalid.local').hostname
  } catch {
    return undefined
  }
}

// An `<img>` already says it is an image, so any src we can name a host for counts,
// with or without a file extension (#637). Bare pasted text still needs one.
export const isImageElementSrc = (src: string): boolean =>
  isImageUrl(src) || imageSourceHost(src) !== undefined
