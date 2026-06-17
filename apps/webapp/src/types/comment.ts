import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'

export type CommentPreview =
  | { kind: 'img'; src: string; badge?: boolean }
  | { kind: 'video' | 'audio'; src: string }
  | { kind: 'unfurl-src'; src: string }
  | { kind: 'unfurl'; title?: string; image?: string; hostname?: string }
  | { kind: 'label'; text: string }

type CommentAnchorBase = {
  v: 1
  heading_id: string
  section_title?: string
}

export type TextCommentAnchor = CommentAnchorBase & {
  kind: 'text'
  content: string
  html?: string
}

export type MediaCommentAnchor = CommentAnchorBase & {
  kind: 'media'
  node_type: MediaNodeType
  caption?: string
  src?: string
  preview: CommentPreview
}

export type CommentAnchorV1 = TextCommentAnchor | MediaCommentAnchor
