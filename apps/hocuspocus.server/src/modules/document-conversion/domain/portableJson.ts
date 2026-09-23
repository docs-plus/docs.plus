import { isRecord } from '../../../lib/isRecord'
import type { TiptapDocJson } from '../types'
import { type JsonNode, mapNodes } from './mapNodes'

// Every embed is an iframe or a player that DOCX, Markdown and ODT cannot express.
// The `src` is the only part a reader can still follow. `image` is not an embed,
// so it is left alone here. DOCX and Markdown keep `image` as a picture, while
// odtExport degrades it to a link (ODF frames need a measured width).
export const EMBED_NODE_TYPES = new Set([
  'youtube',
  'vimeo',
  'loom',
  'x',
  'spotify',
  'soundcloud',
  'video',
  'audio'
])

/** No `toDOM`, so serializing one throws rather than dropping it. */
const MEDIA_UPLOAD_PLACEHOLDER = 'mediaUploadPlaceholder'

const embedToParagraph = (node: JsonNode): JsonNode => {
  const attrs = isRecord(node.attrs) ? node.attrs : {}
  const src = typeof attrs.src === 'string' ? attrs.src : ''
  const caption = typeof attrs.caption === 'string' ? attrs.caption.trim() : ''
  const label = caption || src
  // An empty text node is not a legal PM node, so a source-less embed leaves a blank line.
  if (label.length === 0) return { type: 'paragraph' }

  const text: JsonNode = { type: 'text', text: label }
  if (src.length > 0) text.marks = [{ type: 'hyperlink', attrs: { href: src } }]
  return { type: 'paragraph', content: [text] }
}

/** Rewrites the nodes only the editor can render, so no writer meets them. */
export const toPortableJson = (doc: TiptapDocJson): TiptapDocJson =>
  mapNodes(doc, (node) => {
    if (node.type === MEDIA_UPLOAD_PLACEHOLDER) return 'drop'
    if (typeof node.type === 'string' && EMBED_NODE_TYPES.has(node.type)) {
      return embedToParagraph(node)
    }
    return null
  })
