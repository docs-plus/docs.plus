import type { Context } from 'hono'
import mime from 'mime'

import { config } from '../../config/env'
import {
  InternalServerError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} from '../../lib/errors'
import { mediaServiceLogger } from '../../lib/logger'
import type { MediaReference } from '../../lib/rehostMediaUrls'
import { extractFileType } from '../../lib/storage/fileType'
import * as localStorage from '../../lib/storage/storage.local'
import * as S3Storage from '../../lib/storage/storage.s3'
import { checkEnvBoolean } from '../../utils'

// MUST stay a superset of the chat media allowlist (webapp chatMediaMime.ts
// CHAT_MEDIA_ALLOWED_MIME_TYPES + packages/supabase scripts/12-buckets.sql) so "copy chat
// media to document" can re-host any chat attachment — voice notes (audio/webm), heic/bmp,
// mov/mkv, and office docs / archives (inserted as download links) included.
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

// Reaper hook: purges a document's editor (hypermultimedia) media, which the
// Supabase footprint RPC never touches. No-op when storage is unconfigured;
// reuses the same local/S3 split as get/upload so the delete tracks the writes.
export const deleteDocumentMedia = async (documentId: string): Promise<void> => {
  if (!documentId) return

  if (checkEnvBoolean(process.env.PERSIST_TO_LOCAL_STORAGE)) {
    await localStorage.deleteByPrefix(documentId)
    return
  }

  if (!process.env.DO_STORAGE_ENDPOINT) {
    mediaServiceLogger.warn(
      { documentId },
      'Skipping editor-media purge — S3 storage not configured'
    )
    return
  }

  await S3Storage.deleteByPrefix(documentId)
}

// Duplicate hook: re-hosts exactly the objects the copy's snapshot names, under
// the copy's own prefix, so each document owns its media and no purge can strip a
// copy. Bounded by what the document references, not by what the source prefix
// holds — a node the author deleted is not resurrected under a new URL.
export const copyDocumentMedia = async (
  references: MediaReference[],
  targetDocumentId: string
): Promise<number> => {
  if (references.length === 0 || !targetDocumentId) return 0

  const toLocal = checkEnvBoolean(process.env.PERSIST_TO_LOCAL_STORAGE)
  // Refuse rather than warn: with no storage the copy would keep its source's
  // URLs, which is the exact sharing this hook exists to prevent. Unreachable
  // when the snapshot names nothing — the caller skips the call entirely.
  if (!toLocal && !process.env.DO_STORAGE_ENDPOINT) {
    throw new InternalServerError('Storage service not configured')
  }

  const copyObject = toLocal ? localStorage.copyObject : S3Storage.copyObject
  let copied = 0

  // `false` is the source object being genuinely absent — tolerated, because those
  // URLs were already dead and refusing would make a document whose source was
  // purged permanently un-duplicatable. A copy that FAILS throws instead, so the
  // caller rolls the orphans back rather than landing a copy with an empty prefix.
  for (const reference of references) {
    if (await copyObject(reference.documentId, reference.fileName, targetDocumentId)) copied += 1
  }

  const missing = references.length - copied
  mediaServiceLogger[missing > 0 ? 'warn' : 'info'](
    { targetDocumentId, copied, missing },
    'Copied the editor media a duplicate references'
  )
  return copied
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
