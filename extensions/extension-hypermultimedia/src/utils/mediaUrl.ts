// File-extension matchers for raw video/audio URLs. No `g` flag: a sticky
// lastIndex would make repeat `.test()` calls flaky. These back `detectMediaType`
// but not `isMediaUrl` — pasted `.mp4`/`.mp3` URLs stay links (see isMediaUrl).
const videoUrlRegex =
  /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp4|avi|mov|wmv|flv|mkv|3gp|3g2|asf|divx|m4v|mpg|m2v|m4p|mts|m2ts|ogv|rm|rmvb|ts|vob|webm|qt|f4v)$/i

const audioUrlRegex =
  /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp3|wav|aac|flac|ogg|m4a|aiff|ape|asf|m4p|m4b|mp2|mpc|wma|webm|opus|ra|rm|wavpack|wv)$/i

export const isVideoUrl = (url: string): boolean => videoUrlRegex.test(url)

export const isAudioUrl = (url: string): boolean => audioUrlRegex.test(url)

// Twin of `extension-hyperlink`'s copy. Adding a scheme to one and not the
// other opens a hole in the twin, so preflight diffs them byte-for-byte.
const DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript|file|blob):/i

/** Inline image payloads, the one `data:` form a media node accepts. SVG is excluded — it carries script. */
const INLINE_IMAGE_DATA_RE = /^data:image\/(?!svg\+xml)/i

/**
 * Scheme gate for every stored media `src`: embed builders refuse to render a bad
 * URL, but the raw value still lands in the collaborative document and `window.open`.
 * `allowInlineImage` opts a path into base64 images; `Image.allowBase64` still decides.
 */
export const isSafeMediaSrc = (
  src: string | null | undefined,
  { allowInlineImage = false }: { allowInlineImage?: boolean } = {}
): src is string => {
  if (typeof src !== 'string' || src.length === 0) return false
  if (allowInlineImage && INLINE_IMAGE_DATA_RE.test(src)) return true
  // Test a control-stripped copy: the URL parser drops ASCII tab/LF/CR, so
  // `java\tscript:` would otherwise smuggle a dangerous scheme past the regex.
  // eslint-disable-next-line no-control-regex -- matching C0 controls is the point
  return !DANGEROUS_SCHEME_RE.test(src.replace(/[\u0000-\u0020]+/g, ''))
}
