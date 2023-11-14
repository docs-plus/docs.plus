const mimeTypeMap = {
  image: new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'image/tiff'
    // ... other image mime types
  ]),
  video: new Set([
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
    'video/x-matroska'
    // ... other video mime types
  ]),
  audio: new Set([
    'audio/mpeg',
    'audio/ogg',
    'audio/x-wav',
    'audio/webm',
    'audio/aac',
    'audio/flac',
    'audio/x-ms-wma'
    // ... other audio mime types
  ])
}

export const extractFileType = (mimeType) => {
  mimeType = mimeType.toLowerCase()

  for (const [category, mimeTypes] of Object.entries(mimeTypeMap)) {
    if (mimeTypes.has(mimeType)) {
      return category
    }
  }

  return 'unknown'
}
