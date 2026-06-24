import type { MessageMediaKind } from '@types'

/** Keep in sync with `packages/supabase/scripts/12-buckets.sql` media bucket allowlist. */
export const CHAT_MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
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
] as const

/** Keep in sync with `validate_message_medias()` allowed_exts in 10-3-func-message.sql. */
export const CHAT_MEDIA_ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
  'mp4',
  'webm',
  'mov',
  'm4v',
  'mkv',
  'ogv',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'opus',
  'pdf',
  'txt',
  'csv',
  'md',
  'markdown',
  'json',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip'
] as const

const ALLOWED_MIME_SET = new Set<string>(CHAT_MEDIA_ALLOWED_MIME_TYPES)
const ALLOWED_EXT_SET = new Set<string>(CHAT_MEDIA_ALLOWED_EXTENSIONS)

export const CHAT_MEDIA_BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'dll',
  'scr',
  'vbs',
  'js',
  'sh',
  'app',
  'dmg',
  'jar',
  'apk',
  'svg'
])

export const CHAT_MEDIA_ACCEPT = CHAT_MEDIA_ALLOWED_MIME_TYPES.join(',')

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/opus',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip'
}

const extensionFromName = (name: string): string | null => {
  if (!name.includes('.')) return null
  const ext = name.split('.').pop()?.trim().toLowerCase()
  return ext || null
}

export const chatMediaStorageExtension = (file: File): string => {
  const fromName = extensionFromName(file.name)
  if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName

  const subtype = file.type.split('/')[1]
  if (!subtype) return 'bin'
  return subtype === 'jpeg' ? 'jpg' : subtype
}

export const inferMessageMediaKindFromExtension = (fileName: string): MessageMediaKind | null => {
  const ext = extensionFromName(fileName)
  if (!ext) return null
  const mime = EXTENSION_MIME[ext]
  if (!mime) return null
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

export const resolveChatMediaMime = (file: File): string => {
  // Strip MIME parameters — MediaRecorder tags voice notes `audio/webm;codecs=opus`,
  // but the storage bucket allowlist + isChatMediaMimeAllowed match the bare type only,
  // so the parameterized form is rejected on upload.
  const declared = file.type?.split(';')[0]?.trim().toLowerCase()
  if (declared) return declared
  const ext = extensionFromName(file.name)
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext]
  return ''
}

export const isChatMediaMimeAllowed = (mime: string): boolean => {
  const normalized = mime.trim().toLowerCase()
  return normalized.length > 0 && ALLOWED_MIME_SET.has(normalized)
}

export const isChatMediaExtensionAllowed = (fileName: string): boolean => {
  const ext = extensionFromName(fileName)
  if (!ext) return false
  if (CHAT_MEDIA_BLOCKED_EXTENSIONS.has(ext)) return false
  return ALLOWED_EXT_SET.has(ext)
}

/** Returns a user-facing error, or null when the file may upload. */
export const validateChatMediaFile = (file: File): string | null => {
  if (file.size > 0 && !isChatMediaExtensionAllowed(file.name)) {
    return 'This file type is not allowed'
  }

  const mime = resolveChatMediaMime(file)
  if (mime && isChatMediaMimeAllowed(mime)) return null

  const ext = extensionFromName(file.name)
  if (ext && ALLOWED_EXT_SET.has(ext)) return null

  return 'This file type is not allowed'
}
