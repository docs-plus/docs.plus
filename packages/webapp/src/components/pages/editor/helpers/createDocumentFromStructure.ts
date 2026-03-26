import { type Editor, TIPTAP_NODES } from '@types'

/**
 * Recursively converts a content item to flat ProseMirror nodes
 */
function contentToProseMirror(item: any): any[] {
  if (!item || !item.type) return []

  if (item.type === 'paragraph') {
    return [
      {
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        content: item.content ? [{ type: TIPTAP_NODES.TEXT_TYPE, text: item.content }] : []
      }
    ]
  }

  if (item.type === 'heading') {
    const level = item.level || 2
    const nodes: any[] = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level },
        content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: item.title || 'Untitled' }]
      }
    ]

    if (Array.isArray(item.contents)) {
      for (const child of item.contents) {
        nodes.push(...contentToProseMirror(child))
      }
    }

    if (nodes.length === 1) {
      nodes.push({
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        content: []
      })
    }

    return nodes
  }

  if (item.type === 'bulletList') {
    const listItems = (item.content || []).map((li: any) => ({
      type: 'listItem',
      content: [
        {
          type: TIPTAP_NODES.PARAGRAPH_TYPE,
          content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: li.text || li }]
        }
      ]
    }))
    return [{ type: 'bulletList', content: listItems }]
  }

  if (item.type === 'orderedList') {
    const listItems = (item.content || []).map((li: any) => ({
      type: 'listItem',
      content: [
        {
          type: TIPTAP_NODES.PARAGRAPH_TYPE,
          content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: li.text || li }]
        }
      ]
    }))
    return [{ type: 'orderedList', content: listItems }]
  }

  return []
}

/**
 * Converts a section to flat ProseMirror nodes (H1 + body blocks)
 */
function sectionToProseMirror(section: any): any[] {
  const nodes: any[] = [
    {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: { level: 1 },
      content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: section.title || 'Untitled Section' }]
    }
  ]

  if (Array.isArray(section.contents)) {
    for (const item of section.contents) {
      nodes.push(...contentToProseMirror(item))
    }
  }

  if (nodes.length === 1) {
    nodes.push({
      type: TIPTAP_NODES.PARAGRAPH_TYPE,
      content: []
    })
  }

  return nodes
}

/**
 * Fast document creation using direct insertContent.
 * Generates flat heading + block sequences (no nesting).
 */
export const createDocumentFromStructure = ({ editor }: { editor: Editor }) => {
  return (structure: any) => {
    if (!editor || !editor.commands) return false

    if (!structure.sections || !Array.isArray(structure.sections)) {
      console.error('Invalid document structure: missing sections array')
      return false
    }

    const content = structure.sections.flatMap(sectionToProseMirror)

    try {
      if (content.length > 0) {
        editor.commands.setContent(content)
        return true
      }
      return false
    } catch (err) {
      console.error('Error inserting content:', err)
      return false
    }
  }
}
