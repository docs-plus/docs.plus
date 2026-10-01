import type { JSONContent } from '@tiptap/core'

import { isRecord } from '../../../lib/isRecord'
import { isMediaHref } from '../../document-content/domain/media'
import { type JsonNode, mapNodes } from '../../document-conversion/domain/mapNodes'
import {
  EMBED_NODE_TYPES,
  MEDIA_UPLOAD_PLACEHOLDER
} from '../../document-conversion/domain/portableJson'

const isMediaLink = (mark: unknown): boolean =>
  isRecord(mark) && isRecord(mark.attrs) && isMediaHref(mark.attrs.href)

// `image` is inline, so it becomes text. An embed is a block, so it becomes a paragraph.
// A file attachment is a link to the media route; it keeps its name and loses the link.
const placeholder = (node: JsonNode): JsonNode | null => {
  if (node.type === 'image') return { type: 'text', text: '[image]' }
  if (typeof node.type === 'string' && EMBED_NODE_TYPES.has(node.type)) {
    return { type: 'paragraph', content: [{ type: 'text', text: `[${node.type}]` }] }
  }
  if (Array.isArray(node.marks) && node.marks.some(isMediaLink)) {
    return { ...node, marks: node.marks.filter((mark) => !isMediaLink(mark)) }
  }
  return null
}

/**
 * No media URL may reach an agent; each media node becomes a placeholder.
 * Run it before `toPortableJson`, which links an embed to its `src`.
 */
export const redactMedia = (doc: JSONContent): JSONContent => mapNodes(doc, placeholder)

const isMediaNode = (node: JSONContent): boolean =>
  node.type === MEDIA_UPLOAD_PLACEHOLDER || placeholder(node as JsonNode) !== null

/** Media at any depth, so a block edit can refuse to delete a picture it only saw as a placeholder. */
export const hasMedia = (nodes: readonly JSONContent[]): boolean =>
  nodes.some((node) => isMediaNode(node) || hasMedia(node.content ?? []))
