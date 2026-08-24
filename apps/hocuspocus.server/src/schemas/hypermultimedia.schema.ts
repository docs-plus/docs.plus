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

// Must stay a superset of the chat media allowlist so "copy chat media to
// document" can re-host any attachment. Duplicate copy runs inside the request;
// Bun's idleTimeout closes the socket but not the handler, so N is the only
// bound (32 × 10 MB × 100 req ≈ 32 GB/IP/15 min). The richest live doc names 17.
export const MAX_DUPLICATE_MEDIA_OBJECTS = 32

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-matroska',
  'audio/mpeg',
  'audio/webm',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/opus',
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
