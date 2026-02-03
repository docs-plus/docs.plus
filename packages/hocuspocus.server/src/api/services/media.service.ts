import type { Context } from 'hono'
import mime from 'mime'

import {
  InternalServerError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} from '../../lib/errors'
import { mediaServiceLogger } from '../../lib/logger'
import { extractFileType } from '../../lib/storage/fileType'
import * as localStorage from '../../lib/storage/storage.local'
import * as S3Storage from '../../lib/storage/storage.s3'
import { checkEnvBolean } from '../../utils'

// Allowed file types (MIME types)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf'
]

// Max file size: 50MB
const MAX_FILE_SIZE = parseInt(process.env.DO_STORAGE_MAX_FILE_SIZE || '52428800', 10)

export const getMedia = async (documentId: string, mediaId: string, c: Context) => {
  if (checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE)) {
    return localStorage.get(documentId, mediaId, c)
  }

  return S3Storage.get(documentId, mediaId, c)
}

export const uploadMedia = async (documentId: string, mediaFile: File) => {
  try {
    // Validate file exists
    if (!mediaFile) {
      throw new InternalServerError('No file provided')
    }

    // Validate file size
    if (mediaFile.size > MAX_FILE_SIZE) {
      mediaServiceLogger.warn(
        { documentId, fileSize: mediaFile.size, maxSize: MAX_FILE_SIZE },
        'File too large'
      )
      throw new PayloadTooLargeError(
        `File size ${(mediaFile.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB`
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(mediaFile.type)) {
      mediaServiceLogger.warn({ documentId, mimeType: mediaFile.type }, 'Unsupported file type')
      throw new UnsupportedMediaTypeError(
        `File type ${mediaFile.type} is not allowed. Allowed types: images, videos, audio, PDF`
      )
    }

    const canPersist2Local = checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE) || false

    // Local storage
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

    // S3 storage
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
    // Re-throw application errors
    if (error instanceof PayloadTooLargeError || error instanceof UnsupportedMediaTypeError) {
      throw error
    }

    // Log and wrap unknown errors
    mediaServiceLogger.error({ err: error, documentId }, 'Error uploading media')
    throw new InternalServerError('Failed to upload file')
  }
}
