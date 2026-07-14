import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem, MessageMediaKind, TMsgRow } from '@types'

const GALLERY_MEDIA_TYPES = ['image', 'video', 'audio'] as const

type GalleryMediaKind = (typeof GALLERY_MEDIA_TYPES)[number]

export type GalleryMediaItem = MessageMediaItem & { type: GalleryMediaKind }

export type GallerySourceContext = {
  authorUserId?: string | null
  authorName?: string | null
  authorAvatarUrl?: string | null
  authorAvatarUpdatedAt?: string | null
  sentAtLabel?: string | null
}

export type GalleryOpenOptions = GallerySourceContext & {
  caption?: string | null
  originMessage?: TMsgRow | null
}

type GallerySessionSnapshot = {
  items: GalleryMediaItem[]
  index: number
  autoplayIndex: number
  caption: string | null
  source: GallerySourceContext | null
  originMessage: TMsgRow | null
}

const isGalleryMediaType = (type: MessageMediaKind): type is GalleryMediaKind =>
  (GALLERY_MEDIA_TYPES as readonly MessageMediaKind[]).includes(type)

export const mediaKey = (media: Pick<MessageMediaItem, 'path' | 'url'>): string =>
  media.path ?? media.url

/** One pass: type buckets + feed `visuals` (image+video in input order). */
export function partitionMessageMedias(medias: MessageMediaItem[]) {
  const images: MessageMediaItem[] = []
  const videos: MessageMediaItem[] = []
  const audio: MessageMediaItem[] = []
  const files: MessageMediaItem[] = []
  const visuals: MessageMediaItem[] = []

  for (const media of medias) {
    switch (media.type) {
      case 'image':
        images.push(media)
        visuals.push(media)
        break
      case 'video':
        videos.push(media)
        visuals.push(media)
        break
      case 'audio':
        audio.push(media)
        break
      case 'file':
        files.push(media)
        break
      default: {
        const _exhaustive: never = media.type
        void _exhaustive
      }
    }
  }

  return { images, videos, audio, files, visuals }
}

/** Lightbox order: images → videos → audio (AGENTS contract; not feed order). */
const buildGalleryPlaylist = (medias: MessageMediaItem[]): GalleryMediaItem[] => {
  const { images, videos, audio } = partitionMessageMedias(medias)
  return [...images, ...videos, ...audio].filter((media): media is GalleryMediaItem =>
    isGalleryMediaType(media.type)
  )
}

const resolveGalleryStartIndex = (
  playlist: GalleryMediaItem[],
  at?: number | MessageMediaItem
): number => {
  if (playlist.length === 0) return 0
  if (typeof at === 'number') {
    return Math.min(Math.max(at, 0), playlist.length - 1)
  }
  if (at) {
    const key = mediaKey(at)
    const idx = playlist.findIndex((media) => mediaKey(media) === key)
    return idx === -1 ? 0 : idx
  }
  return 0
}

const buildGallerySource = (
  options?: GalleryOpenOptions
): Pick<GallerySessionSnapshot, 'caption' | 'source' | 'originMessage'> => {
  if (!options) {
    return { caption: null, source: null, originMessage: null }
  }

  const caption = options.caption?.trim() || null
  return {
    caption,
    source: {
      authorUserId: options.authorUserId ?? null,
      authorName: options.authorName?.trim() || null,
      authorAvatarUrl: options.authorAvatarUrl ?? null,
      authorAvatarUpdatedAt: options.authorAvatarUpdatedAt ?? null,
      sentAtLabel: options.sentAtLabel ?? null
    },
    originMessage: options.originMessage ?? null
  }
}

/** Playlist order, start index, and overlay-controls context in one pass. */
export const openGallerySession = (
  medias: MessageMediaItem[],
  at?: number | MessageMediaItem,
  options?: GalleryOpenOptions
): GallerySessionSnapshot | null => {
  const normalized = parseMessageMedias(medias)
  const items = buildGalleryPlaylist(normalized)
  if (items.length === 0) return null

  const index = resolveGalleryStartIndex(items, at)
  const { caption, source, originMessage } = buildGallerySource(options)

  return {
    items,
    index,
    autoplayIndex: index,
    caption,
    source,
    originMessage
  }
}
