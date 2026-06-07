export const inputRegex =
  /(?:^|\s)(!?\[([^\]]*)\]\(((?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?)\))(?=\s|$)/gi

const httpImageUrlRegex =
  /^(?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?$/i

export const isImageUrl = (url: string): boolean => {
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('blob:')) return true
  return httpImageUrlRegex.test(url)
}
