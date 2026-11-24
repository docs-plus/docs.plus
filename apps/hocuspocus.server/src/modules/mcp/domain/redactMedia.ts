import type { JSONContent } from '@tiptap/core'

import { isRecord } from '../../../lib/isRecord'
import { isMediaHref } from '../../document-content/domain/media'
import type { JsonNode } from '../../document-conversion/domain/mapNodes'
import {
  EMBED_NODE_TYPES,
  MEDIA_UPLOAD_PLACEHOLDER
} from '../../document-conversion/domain/portableJson'
import { replaceLineBreaks } from './replaceLineBreaks'

const MAX_IMAGE_ALT_CHARS = 120
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

const isMediaLink = (mark: unknown): boolean =>
  isRecord(mark) && isRecord(mark.attrs) && isMediaHref(mark.attrs.href)

const getMediaLinkHref = (node: JsonNode): string | null => {
  if (!Array.isArray(node.marks)) return null
  for (const mark of node.marks) {
    if (isMediaLink(mark)) return (mark.attrs as { href: string }).href
  }
  return null
}

const formatImagePlaceholder = (node: JsonNode): string => {
  const raw = isRecord(node.attrs) && typeof node.attrs.alt === 'string' ? node.attrs.alt : ''
  const cleaned = replaceLineBreaks(raw, ' ').replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return '[image]'
  const codePoints = Array.from(cleaned)
  if (codePoints.length <= MAX_IMAGE_ALT_CHARS) return `[image: ${cleaned}]`
  return `[image: ${codePoints.slice(0, MAX_IMAGE_ALT_CHARS).join('').trimEnd()}…]`
}

const stripMediaLinkMarks = (node: JsonNode): JsonNode | null => {
  if (!Array.isArray(node.marks) || !node.marks.some(isMediaLink)) return null
  const remaining = node.marks.filter((mark) => !isMediaLink(mark))
  if (remaining.length > 0) return { ...node, marks: remaining }
  const copy: JsonNode = { ...node }
  delete copy.marks
  return copy
}

// `image` is inline, so it becomes text. Uploads and embeds are blocks, so they become paragraphs.
// A file link keeps its name and drops the media link mark.
const placeholder = (node: JsonNode): JsonNode | null => {
  if (node.type === 'image') return { type: 'text', text: formatImagePlaceholder(node) }
  if (node.type === MEDIA_UPLOAD_PLACEHOLDER) {
    return { type: 'paragraph', content: [{ type: 'text', text: '[upload in progress]' }] }
  }
  if (typeof node.type === 'string' && EMBED_NODE_TYPES.has(node.type)) {
    return { type: 'paragraph', content: [{ type: 'text', text: `[${node.type}]` }] }
  }
  return stripMediaLinkMarks(node)
}

interface Frame {
  source: unknown[]
  target: JsonNode[]
}

/**
 * No media URL may reach an agent; each media node becomes a placeholder.
 * Iterative walk with explicit stack so deeply nested documents cannot overflow.
 */
export const redactMedia = (doc: JSONContent): JSONContent => {
  const content: JsonNode[] = []
  const stack: Frame[] = [
    { source: Array.isArray(doc.content) ? doc.content : [], target: content }
  ]

  while (stack.length > 0) {
    const { source, target } = stack.pop() as Frame
    let activeMediaHref: string | null = null
    let runHasText = false

    const flushMediaLinkRun = () => {
      if (activeMediaHref === null) return
      target.push({ type: 'text', text: runHasText ? ' [file]' : '[file]' })
      activeMediaHref = null
      runHasText = false
    }

    for (const child of source) {
      if (!isRecord(child)) continue
      const isSpecialMedia =
        child.type === 'image' ||
        child.type === MEDIA_UPLOAD_PLACEHOLDER ||
        (typeof child.type === 'string' && EMBED_NODE_TYPES.has(child.type))
      const fileLinkHref = isSpecialMedia ? null : getMediaLinkHref(child)

      if (fileLinkHref !== activeMediaHref) {
        flushMediaLinkRun()
      }

      if (fileLinkHref !== null) {
        activeMediaHref = fileLinkHref
        if (typeof child.text === 'string' && child.text.length > 0) {
          runHasText = true
        } else if (child.type === 'text') {
          // Avoid emitting ProseMirror-invalid empty text nodes; flush emits `[file]`.
          continue
        }
      }

      const swapped = placeholder(child)
      const copy: JsonNode = { ...(swapped ?? child) }
      if (!swapped && Array.isArray(copy.content)) {
        const nested: JsonNode[] = []
        stack.push({ source: copy.content, target: nested })
        copy.content = nested
      }
      target.push(copy)
    }

    flushMediaLinkRun()
  }

  return { ...doc, content }
}

const isMediaNode = (node: JSONContent): boolean =>
  node.type === 'image' ||
  node.type === MEDIA_UPLOAD_PLACEHOLDER ||
  (typeof node.type === 'string' && EMBED_NODE_TYPES.has(node.type)) ||
  getMediaLinkHref(node as JsonNode) !== null

/** Media at any depth, so a block edit can refuse to delete a picture it only saw as a placeholder. */
export const hasMedia = (nodes: readonly JSONContent[]): boolean => {
  const stack: JSONContent[] = []
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    stack.push(nodes[i])
  }
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (isMediaNode(node)) return true
    const children = node.content
    if (!Array.isArray(children)) continue
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i])
    }
  }
  return false
}
