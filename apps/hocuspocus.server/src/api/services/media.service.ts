import type { Context } from 'hono'
import mime from 'mime'

import { config } from '../../config/env'
import {
  InternalServerError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} from '../../lib/errors'
import { mediaServiceLogger } from '../../lib/logger'
import { extractFileType } from '../../lib/storage/fileType'
import * as localStorage from '../../lib/storage/storage.local'
import * as S3Storage from '../../lib/storage/storage.s3'
import { checkEnvBoolean } from '../../utils'

// Allowed upload MIME types. MUST stay a superset of the chat media allowlist
// (apps/webapp .../chatMediaMime.ts CHAT_MEDIA_ALLOWED_MIME_TYPES + packages/supabase
// scripts/12-buckets.sql) so "copy chat media to document" can re-host any chat
// attachment here — including voice notes (audio/webm), heic/bmp images, mov/mkv
// video, and office docs / archives (inserted as download links).
const ALLOWED_MIME_TYPES = [
  // images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/svg+xml',
  // video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-matroska',
  // audio
  'audio/mpeg',
  'audio/webm',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/opus',
  // documents + archives
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip'
]

export const getMedia = async (documentId: string, mediaId: string, c: Context) => {
  if (checkEnvBoolean(process.env.PERSIST_TO_LOCAL_STORAGE)) {
    return localStorage.get(documentId, mediaId, c)
  }

  return S3Storage.get(documentId, mediaId, c)
}

/** Matches webapp mediaUploadLimits.ts and Supabase media bucket (10 MB). */
const DEFAULT_MEDIA_MAX_FILE_SIZE = 10_485_760

// A media cap under 1 MB is always a misconfigured env (a port/unit mix-up like
// DO_STORAGE_MAX_FILE_SIZE=4000), which rejects every real upload as "0.00MB max";
// floor to the default so a rebuild with a bad value can't brick uploads.
const MIN_PLAUSIBLE_MEDIA_MAX_FILE_SIZE = 1_048_576

const resolveMediaMaxFileSize = (configured: number): number => {
  if (configured >= MIN_PLAUSIBLE_MEDIA_MAX_FILE_SIZE) return configured
  mediaServiceLogger.warn(
    { configured, using: DEFAULT_MEDIA_MAX_FILE_SIZE },
    'DO_STORAGE_MAX_FILE_SIZE below the 1 MB floor; using 10 MB default'
  )
  return DEFAULT_MEDIA_MAX_FILE_SIZE
}

// Resolved once at load so the warning fires at startup, not on every upload.
export const MEDIA_MAX_FILE_SIZE = resolveMediaMaxFileSize(config.storage.s3.maxFileSize)

export const uploadMedia = async (documentId: string, mediaFile: File) => {
  try {
    if (!mediaFile) {
      throw new InternalServerError('No file provided')
    }

    const maxFileSize = MEDIA_MAX_FILE_SIZE

    if (mediaFile.size > maxFileSize) {
      mediaServiceLogger.warn(
        { documentId, fileSize: mediaFile.size, maxSize: maxFileSize },
        'File too large'
      )
      throw new PayloadTooLargeError(
        `File size ${(mediaFile.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(mediaFile.type)) {
      mediaServiceLogger.warn({ documentId, mimeType: mediaFile.type }, 'Unsupported file type')
      throw new UnsupportedMediaTypeError(
        `File type ${mediaFile.type} is not allowed. Allowed types: images, video, audio, documents, archives`
      )
    }

    const canPersist2Local = checkEnvBoolean(process.env.PERSIST_TO_LOCAL_STORAGE)

    if (canPersist2Local) {
      mediaServiceLogger.debug(
        { documentId, fileName: mediaFile.name },
        'Uploading to local storage'
      )
      const result = await localStorage.upload(documentId, mediaFile)
      mediaServiceLogger.info(
        { documentId, fileAddress: result.fileAddress },
        'File uploaded to local storage'
      )
      return result
    }

    if (!process.env.DO_STORAGE_ENDPOINT) {
      mediaServiceLogger.error('No storage configured')
      throw new InternalServerError('Storage service not configured')
    }

    const format = mime.getExtension(mediaFile.type) || 'bin'
    const fileName = `${crypto.randomUUID()}.${format}`
    const fileType = extractFileType(mediaFile.type)
    const Key = `${documentId}/${fileName}`

    mediaServiceLogger.debug(
      { documentId, fileName, fileSize: mediaFile.size },
      'Uploading to S3 storage'
    )
    const buffer = await mediaFile.arrayBuffer()
    await S3Storage.upload(documentId, fileName, new Uint8Array(buffer))

    mediaServiceLogger.info(
      { documentId, fileName, fileSize: mediaFile.size },
      'File uploaded to S3 storage'
    )

    return {
      type: 's3',
      error: false,
      fileType,
      fileName,
      fileAddress: Key
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError || error instanceof UnsupportedMediaTypeError) {
      throw error
    }

    mediaServiceLogger.error({ err: error, documentId }, 'Error uploading media')
    throw new InternalServerError('Failed to upload file')
  }
}
