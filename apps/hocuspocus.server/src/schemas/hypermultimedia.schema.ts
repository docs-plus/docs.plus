import { z } from 'zod'

// Strict charset blocks path-separator / traversal sequences before the id
// ever reaches the filesystem (defense-in-depth with the storage-root check).
const documentIdField = z
  .string()
  .min(1, 'Document ID is required')
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid document ID')

export const documentIdParamSchema = z.object({
  documentId: documentIdField
})

export const mediaIdParamSchema = z.object({
  documentId: documentIdField,
  mediaId: z
    .string()
    .min(1, 'Media ID is required')
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9]+$/, 'Invalid media ID')
})

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>
export type MediaIdParam = z.infer<typeof mediaIdParamSchema>

// MUST stay a superset of the chat media allowlist (webapp chatMediaMime.ts
// CHAT_MEDIA_ALLOWED_MIME_TYPES + packages/supabase scripts/12-buckets.sql). The superset lets
// "copy chat media to document" re-host any chat attachment. Chat attachments include voice
// notes (audio/webm), heic/bmp, mov/mkv, and office docs / archives (inserted as download links).
export const ALLOWED_MIME_TYPES = [
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
