import type { FileTypeCategory } from '../../types'

const mimeTypeMap = {
  image: new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'image/tiff',
    'image/webp'
  ]),
  video: new Set([
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
    'video/x-matroska'
  ]),
  audio: new Set([
    'audio/mpeg',
    'audio/ogg',
    'audio/x-wav',
    'audio/webm',
    'audio/aac',
    'audio/flac',
    'audio/x-ms-wma'
  ])
}

export const extractFileType = (mimeType: string): FileTypeCategory => {
  const normalized = mimeType.toLowerCase()

  for (const [category, mimeTypes] of Object.entries(mimeTypeMap)) {
    if (mimeTypes.has(normalized)) {
      return category as FileTypeCategory
    }
  }

  return 'unknown'
}
