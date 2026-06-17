import { getTocId } from '@components/TipTap/extensions/shared/get-toc-id'
import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import { CHAT_COMMENT } from '@services/chatEvents'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CommentAnchorV1, MediaCommentAnchor, TextCommentAnchor } from '@types'
import { TIPTAP_NODES } from '@types'
import {
  buildCommentPreviewFromUrl,
  type CommentPreviewMediaHint,
  mediaCommentLabel,
  parseCommentPreview
} from '@utils/commentPreview'
import PubSub from 'pubsub-js'

export function resolveHeadingIdForDocPos(doc: ProseMirrorNode, pos: number): string | null {
  let headingId: string | null = null
  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    if (child.type.name === TIPTAP_NODES.HEADING_TYPE) {
      headingId = getTocId(child.attrs) ?? null
    }
    offset += child.nodeSize
    if (offset > pos) break
  }

  return headingId
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function isTextCommentAnchor(record: Record<string, unknown>): record is TextCommentAnchor {
  return (
    record.v === 1 &&
    record.kind === 'text' &&
    typeof record.heading_id === 'string' &&
    typeof record.content === 'string'
  )
}

function parseMediaCommentAnchor(record: Record<string, unknown>): MediaCommentAnchor | null {
  if (
    record.v !== 1 ||
    record.kind !== 'media' ||
    typeof record.heading_id !== 'string' ||
    typeof record.node_type !== 'string'
  ) {
    return null
  }

  const preview = parseCommentPreview(record.preview)
  if (!preview) return null

  const caption = optionalTrimmed(record.caption)
  const src = optionalTrimmed(record.src)

  return {
    v: 1,
    kind: 'media',
    heading_id: record.heading_id,
    node_type: record.node_type as MediaNodeType,
    preview,
    ...(caption ? { caption } : {}),
    ...(src ? { src } : {}),
    ...(typeof record.section_title === 'string' ? { section_title: record.section_title } : {})
  }
}

export function buildTextCommentAnchor(
  headingId: string,
  content: string,
  html?: string
): TextCommentAnchor {
  return {
    v: 1,
    kind: 'text',
    heading_id: headingId,
    content,
    ...(html ? { html } : {})
  }
}

export function buildTextCommentAnchorFromEditor(editor: Editor): TextCommentAnchor | null {
  const { selection } = editor.state
  if (selection.empty) return null

  const headingId = resolveHeadingIdForDocPos(editor.state.doc, selection.from)
  if (!headingId) return null

  return buildTextCommentAnchor(
    headingId,
    editor.state.doc.textBetween(selection.from, selection.to, '\n')
  )
}

export function buildMediaCommentAnchor(
  headingId: string,
  nodeType: string,
  attrs: Record<string, unknown>,
  hint?: CommentPreviewMediaHint
): MediaCommentAnchor {
  const caption = optionalTrimmed(attrs.caption)
  const src = optionalTrimmed(attrs.src)
  const preview = buildCommentPreviewFromUrl(nodeType as MediaNodeType, src ?? '', hint)

  return {
    v: 1,
    kind: 'media',
    heading_id: headingId,
    node_type: nodeType as MediaNodeType,
    ...(caption ? { caption } : {}),
    ...(src ? { src } : {}),
    preview
  }
}

export function parseCommentAnchor(raw: unknown): CommentAnchorV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>

  if (isTextCommentAnchor(record)) {
    return {
      v: 1,
      kind: 'text',
      heading_id: record.heading_id,
      content: record.content,
      ...(typeof record.html === 'string' ? { html: record.html } : {}),
      ...(typeof record.section_title === 'string' ? { section_title: record.section_title } : {})
    }
  }

  const media = parseMediaCommentAnchor(record)
  if (media) return media

  if (typeof record.content === 'string' && typeof record.heading_id === 'string') {
    return buildTextCommentAnchor(
      record.heading_id,
      record.content,
      typeof record.html === 'string' ? record.html : undefined
    )
  }

  return null
}

export function getCommentAnchorLabel(anchor: CommentAnchorV1): string {
  if (anchor.kind === 'text') return 'selection'
  return mediaCommentLabel(anchor.node_type, anchor.preview)
}

export function getCommentAnchorExcerpt(anchor: CommentAnchorV1): string {
  if (anchor.kind === 'text') return anchor.content
  if (anchor.caption) return anchor.caption
  if (anchor.src && anchor.src.length <= 96) return anchor.src
  if (anchor.src) return `${anchor.src.slice(0, 93)}…`
  return getCommentAnchorLabel(anchor)
}

export function publishDocumentComment(anchor: CommentAnchorV1): void {
  PubSub.publish(CHAT_COMMENT, { anchor })
}
