import type { MessageMediaItem, MessageMediaKind } from '@types'

import { CHAT_MEDIA_ACCEPT, inferMessageMediaKindFromExtension } from './chatMediaMime'

export { CHAT_MEDIA_ACCEPT }

export const CHAT_MEDIA_BUCKET = 'media'
export const CHAT_MEDIA_MAX_BYTES = 10485760
export const CHAT_MEDIA_MAX_ATTACHMENTS = 10
export const CHAT_MEDIA_MAX_CONCURRENT_UPLOADS = 3
export const CHAT_MEDIA_SIGNED_URL_TTL_SEC = 3600
export const CHAT_MEDIA_MAX_WIDTH_CLASS = 'max-w-[min(400px,100%)]'
export const CHAT_MEDIA_FEED_MAX_WIDTH_PX = 400
export const CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX = 360
export const CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX = 280
export const CHAT_MEDIA_TALL_ASPECT = 0.85
export const CHAT_MEDIA_STACK_GAP_PX = 6
export const CHAT_MEDIA_PLACEHOLDER_ASPECT = 16 / 9
export const CHAT_MEDIA_MOSAIC_GAP_PX = 2

export type MediaPixelSize = { width: number; height: number }

/** Finite positive pixel pair, or null. */
export function positiveMediaDims(width: unknown, height: unknown): MediaPixelSize | null {
  if (
    typeof width === 'number' &&
    typeof height === 'number' &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return { width, height }
  }
  return null
}

export const MESSAGE_MEDIA_KIND_LABEL: Record<MessageMediaKind, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  file: 'File'
}

export const inferMessageMediaKind = (file: File): MessageMediaKind => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return inferMessageMediaKindFromExtension(file.name) ?? 'file'
}

const PUBLIC_MEDIA_PATH_MARKER = '/storage/v1/object/public/media/'

export const parsePathFromPublicMediaUrl = (url: string): string | null => {
  const idx = url.indexOf(PUBLIC_MEDIA_PATH_MARKER)
  if (idx === -1) return null
  try {
    return decodeURIComponent(url.slice(idx + PUBLIC_MEDIA_PATH_MARKER.length))
  } catch {
    return null
  }
}

export const mediaStoragePath = (media: MessageMediaItem): string | null => {
  if (media.path?.trim()) return media.path.trim()
  if (media.url.startsWith('http://') || media.url.startsWith('https://')) {
    return parsePathFromPublicMediaUrl(media.url)
  }
  // data:/blob: are display URLs, not bucket keys — never send them to createSignedUrl.
  if (media.url.startsWith('data:') || media.url.startsWith('blob:')) return null
  return media.url.trim() || null
}

export const messageMediasForInsert = (medias: MessageMediaItem[]): MessageMediaItem[] =>
  medias.map((media) => {
    const path = mediaStoragePath(media)
    if (!path) return media
    const dims = positiveMediaDims(media.width, media.height)
    return {
      path,
      url: path,
      type: media.type,
      ...(media.name ? { name: media.name } : {}),
      ...(media.size != null ? { size: media.size } : {}),
      ...(dims ? { width: dims.width, height: dims.height } : {}),
      ...(media.spoiler ? { spoiler: true } : {})
    }
  })

export const formatAttachmentSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const attachmentExtensionLabel = (name?: string): string => {
  if (!name?.includes('.')) return 'FILE'
  const ext = name.split('.').pop()?.trim()
  if (!ext) return 'FILE'
  return ext.slice(0, 4).toUpperCase()
}

const MESSAGE_MEDIA_KINDS: MessageMediaKind[] = ['image', 'video', 'audio', 'file']

const isMessageMediaKind = (value: unknown): value is MessageMediaKind =>
  typeof value === 'string' && MESSAGE_MEDIA_KINDS.includes(value as MessageMediaKind)

export const parseMessageMedias = (raw: unknown): MessageMediaItem[] => {
  if (!Array.isArray(raw)) return []

  const medias: MessageMediaItem[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const record = item as Record<string, unknown>
    const rawPath = record.path
    const rawUrl = record.url
    const type = record.type

    const path = typeof rawPath === 'string' && rawPath.trim() ? rawPath.trim() : undefined
    const url = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : path

    if (!url) continue
    if (!isMessageMediaKind(type)) continue

    const parsed: MessageMediaItem = { url, type }
    if (path) parsed.path = path
    if (typeof record.name === 'string' && record.name.trim()) {
      parsed.name = record.name
    }
    if (typeof record.size === 'number' && Number.isFinite(record.size) && record.size >= 0) {
      parsed.size = record.size
    }
    const dims = positiveMediaDims(record.width, record.height)
    if (dims) {
      parsed.width = dims.width
      parsed.height = dims.height
    }
    if (record.spoiler === true) {
      parsed.spoiler = true
    }
    medias.push(parsed)
  }

  return medias
}

export const resolveOutgoingMessageType = (
  content: string,
  medias: MessageMediaItem[]
): 'text' | 'image' | 'video' | 'audio' | 'file' => {
  if (content.trim().length > 0) return 'text'
  if (medias.length === 0) return 'text'

  const kinds = new Set(medias.map((media) => media.type))
  if (kinds.size === 1) return medias[0]!.type

  return 'file'
}

export const collectMediaInsertPaths = (medias: MessageMediaItem[]): string[] =>
  // messageMediasForInsert already resolves each media's storage path into `path`.
  messageMediasForInsert(medias)
    .map((media) => media.path)
    .filter((path): path is string => Boolean(path))
