import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { CommentPreview } from '@types'

import { mediaCommentMeta } from './commentReferenceTheme'

export type { CommentReferenceTheme } from './commentReferenceTheme'
export {
  commentReferenceContextBarShell,
  commentReferenceJumpShell,
  commentReferenceTheme,
  mediaCommentLabel
} from './commentReferenceTheme'

export type StaticMediaPreview =
  { kind: 'img'; src: string; badge?: boolean } | { kind: 'video' | 'audio'; src: string }

export type CommentPreviewMediaHint = {
  label?: string
  preview?: (url: string) => StaticMediaPreview | null
  unfurl?: boolean
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

  return { kind: 'label', text: hint?.label ?? mediaCommentMeta(nodeType).label }
}
