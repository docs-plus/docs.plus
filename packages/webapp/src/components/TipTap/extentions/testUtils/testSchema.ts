import { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { TIPTAP_NODES } from '@types'

export interface HeadingSnapshot {
  level: number
  title: string
  depth: number
  pos: number
  endPos: number
}

export const createTestSchema = (): Schema =>
  new Schema({
    nodes: {
      [TIPTAP_NODES.DOC_TYPE]: {
        content: `${TIPTAP_NODES.HEADING_TYPE}+`
      },
      [TIPTAP_NODES.HEADING_TYPE]: {
        content: `${TIPTAP_NODES.CONTENT_HEADING_TYPE} ${TIPTAP_NODES.CONTENT_WRAPPER_TYPE}`,
        attrs: {
          level: { default: 1 },
          id: { default: null }
        }
      },
      [TIPTAP_NODES.CONTENT_HEADING_TYPE]: {
        content: `${TIPTAP_NODES.TEXT_TYPE}*`,
        attrs: {
          level: { default: 1 },
          id: { default: null }
        }
      },
      [TIPTAP_NODES.CONTENT_WRAPPER_TYPE]: {
        content: `(${TIPTAP_NODES.PARAGRAPH_TYPE})* ${TIPTAP_NODES.HEADING_TYPE}*`
      },
      [TIPTAP_NODES.PARAGRAPH_TYPE]: {
        group: 'block',
        content: `${TIPTAP_NODES.TEXT_TYPE}*`
      },
      [TIPTAP_NODES.TEXT_TYPE]: {
        group: 'inline'
      }
    },
    marks: {}
  })

export const paragraph = (schema: Schema, text: string = ''): ProseMirrorNode => {
  const content = text.length ? [schema.text(text)] : undefined
  return schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create(null, content)
}

export const contentHeading = (schema: Schema, level: number, text: string): ProseMirrorNode => {
  const content = text.length ? [schema.text(text)] : undefined
  return schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level }, content)
}

export const contentWrapper = (schema: Schema, children: ProseMirrorNode[] = []): ProseMirrorNode =>
  schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, children)

export const heading = (
  schema: Schema,
  level: number,
  title: string,
  children: ProseMirrorNode[] = []
): ProseMirrorNode => {
  const id = `${title}-${level}`.toLowerCase().replace(/\s+/g, '-')
  return schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level, id }, [
    contentHeading(schema, level, title),
    contentWrapper(schema, children)
  ])
}

export const buildDoc = (schema: Schema, roots: ProseMirrorNode[]): ProseMirrorNode =>
  schema.nodes[TIPTAP_NODES.DOC_TYPE].create(null, roots)

export const getHeadingSnapshot = (doc: ProseMirrorNode): HeadingSnapshot[] => {
  const headings: HeadingSnapshot[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) return
    const level = node.firstChild?.attrs?.level || node.attrs.level || 1
    const rawDepth = doc.resolve(pos).depth
    headings.push({
      level,
      title: node.firstChild?.textContent || '',
      depth: rawDepth === 0 ? 1 : rawDepth,
      pos,
      endPos: pos + node.nodeSize
    })
  })
  return headings
}

export const getFirstTextPos = (doc: ProseMirrorNode): number => {
  let textPos = -1
  doc.descendants((node, pos) => {
    if (textPos !== -1) return false
    if (node.isText) {
      textPos = pos
      return false
    }
    return true
  })

  if (textPos === -1) {
    throw new Error('Could not find a text node position in test document')
  }

  return textPos
}
