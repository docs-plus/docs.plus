// Bang is required so plain `[text](url)` links stay text; no `g` flag — input rules
// reuse the regex across keystrokes and a sticky lastIndex makes matches flaky.
export const inputRegex =
  /(?:^|\s)(!\[([^\]]*)\]\(((?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?)\))(?=\s|$)/i

const httpImageUrlRegex =
  /^(?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?$/i

export const isImageUrl = (url: string): boolean => {
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('blob:')) return true
  return httpImageUrlRegex.test(url)
}
