/** Matches backend `DO_STORAGE_MAX_FILE_SIZE` default (10 MB). */
export const MEDIA_MAX_UPLOAD_BYTES = 10_485_760

export const formatMediaMaxUploadSize = (bytes = MEDIA_MAX_UPLOAD_BYTES): string => {
  const mb = bytes / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`
}

export const mediaUploadLimitExceededMessage = (): string =>
  `File exceeds the ${formatMediaMaxUploadSize()} upload limit.`
