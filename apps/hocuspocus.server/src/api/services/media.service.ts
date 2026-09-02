import type { Context } from 'hono'

import { config } from '../../config/env'
import {
  InternalServerError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} from '../../lib/errors'
import { mediaServiceLogger } from '../../lib/logger'
import type { MediaReference } from '../../lib/rehostMediaUrls'
import { getMediaStore } from '../../lib/storage/mediaStore'
import { ALLOWED_MIME_TYPES } from '../../schemas/hypermultimedia.schema'

export const getMedia = async (documentId: string, mediaId: string, c: Context) =>
  getMediaStore().get(documentId, mediaId, c)

// Reaper hook: purges a document's editor (hypermultimedia) media, which the
// Supabase footprint RPC never touches. No-op when storage is unconfigured;
// reuses the same local/S3 split as get/upload so the delete tracks the writes.
export const deleteDocumentMedia = async (documentId: string): Promise<void> => {
  if (!documentId) return

  const store = getMediaStore()
  if (!store.configured) {
    mediaServiceLogger.warn(
      { documentId },
      'Skipping editor-media purge — S3 storage not configured'
    )
    return
  }

  await store.deleteByPrefix(documentId)
}

// Duplicate hook: re-hosts exactly the objects the copy's snapshot names, under the
// copy's own prefix. Each document then owns its media, and no purge can strip a copy.
// Bounded by what the document references, not by what the source prefix holds — a node
// the author deleted is not resurrected under a new URL.
export const copyDocumentMedia = async (
  references: MediaReference[],
  targetDocumentId: string
): Promise<number> => {
  if (references.length === 0 || !targetDocumentId) return 0

  const store = getMediaStore()
  // Refuse rather than warn: with no storage the copy would keep its source's
  // URLs, which is the exact sharing this hook exists to prevent. Unreachable
  // when the snapshot names nothing — the caller skips the call entirely.
  if (!store.configured) throw new InternalServerError('Storage service not configured')

  const copyObject = store.copyObject
  let copied = 0

  // `false` is the source object being genuinely absent. The absence is tolerated,
  // because those URLs were already dead, and refusing would make a document whose
  // source was purged permanently un-duplicatable. A copy that FAILS throws instead, so
  // the caller rolls the orphans back rather than landing a copy with an empty prefix.
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
// DO_STORAGE_MAX_FILE_SIZE=4000). Such a cap rejects every real upload as "0.00MB max".
// Floor to the default so a rebuild with a bad value can't brick uploads.
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

    const store = getMediaStore()
    if (!store.configured) {
      mediaServiceLogger.error('No storage configured')
      throw new InternalServerError('Storage service not configured')
    }

    return store.upload(documentId, mediaFile)
  } catch (error) {
    if (error instanceof PayloadTooLargeError || error instanceof UnsupportedMediaTypeError) {
      throw error
    }

    mediaServiceLogger.error({ err: error, documentId }, 'Error uploading media')
    throw new InternalServerError('Failed to upload file')
  }
}
