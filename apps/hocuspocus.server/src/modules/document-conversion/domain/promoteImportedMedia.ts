import {
  detectMediaType,
  isSafeMediaSrc,
  type MediaNodeType
} from '@docs.plus/extension-hypermultimedia'

import { isRecord } from '../../../lib/isRecord'
import type { TiptapDocJson } from '../types'

const BLOCK_MEDIA = new Set<MediaNodeType>([
  'video',
  'audio',
  'youtube',
  'vimeo',
  'soundcloud',
  'spotify',
  'loom',
  'x'
])

/** First child must stay a paragraph. A block here is 422. */
const PARAGRAPH_FIRST = new Set(['listItem', 'taskItem'])

type JsonNode = Record<string, unknown>

const isWhitespaceText = (node: JsonNode): boolean =>
  node.type === 'text' && typeof node.text === 'string' && node.text.trim() === ''

const significantChildren = (content: unknown[]): JsonNode[] =>
  content.filter((child): child is JsonNode => isRecord(child) && !isWhitespaceText(child))

/** Autolink / `[url](url)` only. A labeled link stays a link. */
const soleLinkHref = (node: JsonNode): string | null => {
  if (node.type !== 'text' || typeof node.text !== 'string') return null
  if (!Array.isArray(node.marks)) return null

  const mark = node.marks.find(
    (entry) => isRecord(entry) && (entry.type === 'link' || entry.type === 'hyperlink')
  )
  if (!isRecord(mark) || !isRecord(mark.attrs) || typeof mark.attrs.href !== 'string') return null
  if (node.text !== mark.attrs.href) return null
  return mark.attrs.href
}

const mediaNode = (kind: MediaNodeType, src: string): JsonNode =>
  kind === 'image' ? { type: 'image', attrs: { src, alt: '' } } : { type: kind, attrs: { src } }

const canReplaceParagraph = (parentType: unknown, replacement: JsonNode): boolean => {
  if (replacement.type === 'paragraph') return true
  return typeof parentType === 'string' && !PARAGRAPH_FIRST.has(parentType)
}

const rewriteParagraph = (paragraph: JsonNode): JsonNode => {
  if (!Array.isArray(paragraph.content)) return paragraph
  const significant = significantChildren(paragraph.content)
  if (significant.length !== 1) return paragraph

  const only = significant[0]
  if (typeof only.type === 'string' && BLOCK_MEDIA.has(only.type as MediaNodeType)) {
    return only
  }

  const href = soleLinkHref(only)
  if (!href) return paragraph

  const kind = detectMediaType(href)
  if (!kind) return paragraph
  if (!isSafeMediaSrc(href, { allowInlineImage: kind === 'image' })) return paragraph

  if (kind === 'image') {
    return { ...paragraph, content: [mediaNode('image', href)] }
  }
  return mediaNode(kind, href)
}

const finalizeChild = (parentType: unknown, walked: JsonNode): JsonNode => {
  if (walked.type !== 'paragraph') return walked
  const replacement = rewriteParagraph(walked)
  return canReplaceParagraph(parentType, replacement) ? replacement : walked
}

interface WalkFrame {
  parentType: unknown
  source: unknown[]
  target: unknown[]
  index: number
  owner?: { draft: JsonNode; grandparentType: unknown; parentTarget: unknown[] }
}

const rewriteChildren = (rootType: unknown, rootChildren: unknown[]): unknown[] => {
  const rootTarget: unknown[] = []
  const stack: WalkFrame[] = [
    { parentType: rootType, source: rootChildren, target: rootTarget, index: 0 }
  ]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index < frame.source.length) {
      const child = frame.source[frame.index++]
      if (!isRecord(child)) {
        frame.target.push(child)
        continue
      }
      if (Array.isArray(child.content)) {
        const childTarget: unknown[] = []
        const draft: JsonNode = { ...child, content: childTarget }
        stack.push({
          parentType: child.type,
          source: child.content,
          target: childTarget,
          index: 0,
          owner: { draft, grandparentType: frame.parentType, parentTarget: frame.target }
        })
      } else {
        frame.target.push(finalizeChild(frame.parentType, child))
      }
      continue
    }

    stack.pop()
    if (frame.owner) {
      frame.owner.parentTarget.push(finalizeChild(frame.owner.grandparentType, frame.owner.draft))
    }
  }

  return rootTarget
}

/**
 * Lifts a block embed out of its paragraph, and promotes a paragraph whose sole
 * child is a bare autolink — text equal to href, so a labeled link stays a link.
 * An image stays inside its paragraph; `listItem` and `taskItem` keep theirs,
 * where a block is a 422. Runs after `wrapStrayInlineNodes`, before the title pass.
 */
export const promoteImportedMedia = (doc: TiptapDocJson): TiptapDocJson => ({
  ...doc,
  // The walk keeps every child, and a markdown parse cannot emit a non-record one.
  content: rewriteChildren(doc.type, doc.content) as Record<string, unknown>[]
})
