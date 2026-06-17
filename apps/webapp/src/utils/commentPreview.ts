import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { CommentPreview } from '@types'

export type StaticMediaPreview =
  | { kind: 'img'; src: string; badge?: boolean }
  | { kind: 'video' | 'audio'; src: string }

export type CommentPreviewMediaHint = {
  label?: string
  preview?: (url: string) => StaticMediaPreview | null
  unfurl?: boolean
}

export const MEDIA_COMMENT_LABELS: Partial<Record<MediaNodeType, string>> = {
  image: 'Picture',
  video: 'Video',
  audio: 'Audio',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  soundcloud: 'SoundCloud',
  loom: 'Loom',
  x: 'X'
}

export function parseCommentPreview(raw: unknown): CommentPreview | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>

  if (p.kind === 'img' && typeof p.src === 'string') {
    return { kind: 'img', src: p.src, ...(p.badge === true ? { badge: true } : {}) }
  }
  if ((p.kind === 'video' || p.kind === 'audio') && typeof p.src === 'string') {
    return { kind: p.kind, src: p.src }
  }
  if (p.kind === 'unfurl-src' && typeof p.src === 'string') {
    return { kind: 'unfurl-src', src: p.src }
  }
  if (p.kind === 'unfurl') {
    return {
      kind: 'unfurl',
      ...(typeof p.title === 'string' ? { title: p.title } : {}),
      ...(typeof p.image === 'string' ? { image: p.image } : {}),
      ...(typeof p.hostname === 'string' ? { hostname: p.hostname } : {})
    }
  }
  if (p.kind === 'label' && typeof p.text === 'string') {
    return { kind: 'label', text: p.text }
  }

  return null
}

export function commentPreviewFromStaticMedia(preview: StaticMediaPreview): CommentPreview {
  if (preview.kind === 'img') {
    return { kind: 'img', src: preview.src, badge: preview.badge }
  }
  return { kind: preview.kind, src: preview.src }
}

export function buildCommentPreviewFromUrl(
  nodeType: MediaNodeType,
  src: string,
  hint: CommentPreviewMediaHint | undefined
): CommentPreview {
  const staticPreview = src && hint?.preview?.(src)
  if (staticPreview) return commentPreviewFromStaticMedia(staticPreview)

  if (hint?.unfurl && src) return { kind: 'unfurl-src', src }

  if (nodeType === 'x') return { kind: 'label', text: 'Post on X' }

  return { kind: 'label', text: hint?.label ?? MEDIA_COMMENT_LABELS[nodeType] ?? 'Media' }
}

export function mediaCommentLabel(nodeType: MediaNodeType, preview: CommentPreview): string {
  if (preview.kind === 'label') return preview.text
  return MEDIA_COMMENT_LABELS[nodeType] ?? 'Media'
}
