import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { CommentAnchorV1, CommentPreview } from '@types'

/** Tailwind class tokens for document-comment chrome (feed jump chip + composer context bar). */
export type CommentReferenceTheme = {
  borderClass: string
  surface: string
  surfaceHover: string
  emphasis: string
}

type MediaCommentMeta = {
  label: string
  theme: CommentReferenceTheme
}

const TEXT_COMMENT_THEME: CommentReferenceTheme = {
  borderClass: 'border-l-primary',
  surface: 'bg-primary/10',
  surfaceHover: 'hover:bg-primary/15',
  emphasis: 'text-primary'
}

const DEFAULT_MEDIA_COMMENT_META: MediaCommentMeta = {
  label: 'Media',
  theme: {
    borderClass: 'border-l-secondary',
    surface: 'bg-secondary/10',
    surfaceHover: 'hover:bg-secondary/15',
    emphasis: 'text-secondary'
  }
}

const MEDIA_COMMENT_META: Partial<Record<MediaNodeType, MediaCommentMeta>> = {
  image: {
    label: 'Picture',
    theme: {
      borderClass: 'border-l-emerald-500',
      surface: 'bg-emerald-500/10',
      surfaceHover: 'hover:bg-emerald-500/15',
      emphasis: 'text-emerald-600 dark:text-emerald-400'
    }
  },
  video: {
    label: 'Video',
    theme: {
      borderClass: 'border-l-violet-500',
      surface: 'bg-violet-500/10',
      surfaceHover: 'hover:bg-violet-500/15',
      emphasis: 'text-violet-600 dark:text-violet-400'
    }
  },
  audio: {
    label: 'Audio',
    theme: {
      borderClass: 'border-l-orange-500',
      surface: 'bg-orange-500/10',
      surfaceHover: 'hover:bg-orange-500/15',
      emphasis: 'text-orange-600 dark:text-orange-400'
    }
  },
  youtube: {
    label: 'YouTube',
    theme: {
      borderClass: 'border-l-[#FF0000]',
      surface: 'bg-[#FF0000]/10',
      surfaceHover: 'hover:bg-[#FF0000]/15',
      emphasis: 'text-[#FF0000]'
    }
  },
  vimeo: {
    label: 'Vimeo',
    theme: {
      borderClass: 'border-l-[#1AB7EA]',
      surface: 'bg-[#1AB7EA]/10',
      surfaceHover: 'hover:bg-[#1AB7EA]/15',
      emphasis: 'text-[#1AB7EA]'
    }
  },
  soundcloud: {
    label: 'SoundCloud',
    theme: {
      borderClass: 'border-l-[#FF5500]',
      surface: 'bg-[#FF5500]/10',
      surfaceHover: 'hover:bg-[#FF5500]/15',
      emphasis: 'text-[#FF5500]'
    }
  },
  loom: {
    label: 'Loom',
    theme: {
      borderClass: 'border-l-[#625DF5]',
      surface: 'bg-[#625DF5]/10',
      surfaceHover: 'hover:bg-[#625DF5]/15',
      emphasis: 'text-[#625DF5]'
    }
  },
  x: {
    label: 'X',
    theme: {
      borderClass: 'border-l-base-content',
      surface: 'bg-base-content/5',
      surfaceHover: 'hover:bg-base-content/10',
      emphasis: 'text-base-content'
    }
  }
}

export function mediaCommentMeta(nodeType: MediaNodeType): MediaCommentMeta {
  return MEDIA_COMMENT_META[nodeType] ?? DEFAULT_MEDIA_COMMENT_META
}

export function commentReferenceTheme(anchor: CommentAnchorV1): CommentReferenceTheme {
  if (anchor.kind === 'text') return TEXT_COMMENT_THEME
  return mediaCommentMeta(anchor.node_type).theme
}

/** Feed jump-chip classes — keep border/surface literals in MEDIA_COMMENT_META for Tailwind JIT. */
export function commentReferenceJumpShell(theme: CommentReferenceTheme): string {
  return `${theme.borderClass} ${theme.surface} ${theme.surfaceHover}`
}

/** Composer context-bar classes (no hover — bar is not interactive). */
export function commentReferenceContextBarShell(theme: CommentReferenceTheme): string {
  return `border-l-[3px] ${theme.borderClass} ${theme.surface}`
}

export function mediaCommentLabel(nodeType: MediaNodeType, preview: CommentPreview): string {
  if (preview.kind === 'label') return preview.text
  return mediaCommentMeta(nodeType).label
}
