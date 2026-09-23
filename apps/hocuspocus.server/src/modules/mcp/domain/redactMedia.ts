import type { JSONContent } from '@tiptap/core'

import { isRecord } from '../../../lib/isRecord'
import { type JsonNode, mapNodes } from '../../document-conversion/domain/mapNodes'
import { EMBED_NODE_TYPES } from '../../document-conversion/domain/portableJson'

// Matched without the `/api` prefix: the webapp builds file links from its REST base URL.
const MEDIA_PATH = '/plugins/hypermultimedia/'

const isMediaLink = (mark: unknown): boolean =>
  isRecord(mark) &&
  isRecord(mark.attrs) &&
  typeof mark.attrs.href === 'string' &&
  mark.attrs.href.includes(MEDIA_PATH)

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
