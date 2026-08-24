import type {
  ConversionWarning,
  TiptapDocJson,
  TitleHeadingBranch,
  TitleHeadingResult
} from '../types'
import { isRecord } from '../types'

type JsonNode = Record<string, unknown>

const TITLE_LEVEL = 1

const inlineText = (node: JsonNode): string => {
  if (!Array.isArray(node.content)) return ''
  return node.content
    .map((child) => (isRecord(child) && typeof child.text === 'string' ? child.text : ''))
    .join('')
}

const asTitleHeading = (node: JsonNode): JsonNode => ({
  ...node,
  attrs: { ...(isRecord(node.attrs) ? node.attrs : {}), level: TITLE_LEVEL }
})

// A promoted paragraph keeps its words but neither its styling nor its
// paragraph-only attrs. Bold or highlighted runs inside a title heading read as
// damage, not as intent.
const promotedHeading = (node: JsonNode): JsonNode => ({
  type: 'heading',
  attrs: { level: TITLE_LEVEL },
  content: Array.isArray(node.content)
    ? node.content.map((child) => {
        if (!isRecord(child)) return child
        const stripped = { ...child }
        delete stripped.marks
        return stripped
      })
    : []
})

const synthesizedHeading = (fallbackTitle: string): JsonNode => {
  const title = fallbackTitle.trim()
  const heading: JsonNode = { type: 'heading', attrs: { level: TITLE_LEVEL } }
  // An empty text node is not a legal PM node, so a blank fallback yields a bare heading.
  if (title.length > 0) heading.content = [{ type: 'text', text: title }]
  return heading
}

/**
 * docs.plus documents are title-first, but real Word files almost never open on
 * a heading. `branch` is returned because a first paragraph silently becoming
 * the document title is a change the importer has to tell the user about.
 */
export const ensureTitleHeading = (
  doc: TiptapDocJson,
  fallbackTitle: string
): TitleHeadingResult => {
  const content = Array.isArray(doc.content) ? doc.content : []
  const [first, ...rest] = content

  if (isRecord(first) && first.type === 'heading') {
    return { doc: { ...doc, content: [asTitleHeading(first), ...rest] }, branch: 'already-heading' }
  }

  if (isRecord(first) && first.type === 'paragraph' && inlineText(first).trim().length > 0) {
    return {
      doc: { ...doc, content: [promotedHeading(first), ...rest] },
      branch: 'promoted-paragraph'
    }
  }

  return {
    doc: { ...doc, content: [synthesizedHeading(fallbackTitle), ...content] },
    branch: 'synthesized'
  }
}

export const titleHeadingText = (doc: TiptapDocJson): string => {
  const [first] = Array.isArray(doc.content) ? doc.content : []
  return isRecord(first) ? inlineText(first).trim() : ''
}

export const titleHeadingWarning = (
  branch: TitleHeadingBranch,
  title: string
): ConversionWarning | null => {
  if (branch === 'promoted-paragraph') {
    return {
      code: 'title-promoted-paragraph',
      message: `The document opened on a paragraph, so "${title}" became its title.`
    }
  }
  if (branch === 'synthesized') {
    return {
      code: 'title-synthesized',
      message: `The document opened on no usable text, so its title was set to "${title}".`
    }
  }
  return null
}
