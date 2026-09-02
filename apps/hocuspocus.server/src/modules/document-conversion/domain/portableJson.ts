import { isRecord } from '../../../lib/isRecord'
import type { TiptapDocJson } from '../types'

type JsonNode = Record<string, unknown>
interface Frame {
  source: unknown[]
  target: JsonNode[]
}

// Every embed is an iframe or a player that DOCX, Markdown and ODT cannot express.
// The `src` is the only part a reader can still follow. `image` is not an embed,
// so it is left alone here. DOCX and Markdown keep `image` as a picture, while
// odtExport degrades it to a link (ODF frames need a measured width).
const EMBED_NODE_TYPES = new Set([
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

/**
 * Iterative by the same rule as `encodeContent` — an explicit stack, never
 * recursion, so deep input cannot overflow the walk.
 */
export const toPortableJson = (doc: TiptapDocJson): TiptapDocJson => {
  const content: JsonNode[] = []
  const stack: Frame[] = [{ source: doc.content ?? [], target: content }]

  while (stack.length > 0) {
    const { source, target } = stack.pop() as Frame

    for (const child of source) {
      if (!isRecord(child)) continue
      if (child.type === MEDIA_UPLOAD_PLACEHOLDER) continue
      if (typeof child.type === 'string' && EMBED_NODE_TYPES.has(child.type)) {
        target.push(embedToParagraph(child))
        continue
      }

      const copy: JsonNode = { ...child }
      if (Array.isArray(child.content)) {
        const nested: JsonNode[] = []
        copy.content = nested
        stack.push({ source: child.content, target: nested })
      }
      target.push(copy)
    }
  }

  return { ...doc, content }
}
