import { type Editor,TIPTAP_NODES } from '@types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Recursively converts a content item to ProseMirror node format
 */
function contentToProseMirror(item: any): any {
  if (!item || !item.type) return null

  // Paragraph
  if (item.type === 'paragraph') {
    return {
      type: TIPTAP_NODES.PARAGRAPH_TYPE,
      content: item.content ? [{ type: TIPTAP_NODES.TEXT_TYPE, text: item.content }] : []
    }
  }

  // Heading (H2-H10) - recursive structure
  if (item.type === 'heading') {
    const level = item.level || 2
    const contentWrapperContent: any[] = []

    // Process contents recursively
    if (Array.isArray(item.contents)) {
      for (const child of item.contents) {
        const childNode = contentToProseMirror(child)
        if (childNode) {
          contentWrapperContent.push(childNode)
        }
      }
    }

    // If no content, add empty paragraph
    if (contentWrapperContent.length === 0) {
      contentWrapperContent.push({
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        content: []
      })
    }

    return {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: { level, id: uuidv4() },
      content: [
        {
          type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
          attrs: { level },
          content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: item.title || 'Untitled' }]
        },
        {
          type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
          content: contentWrapperContent
        }
      ]
    }
  }

  // Bullet list
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
    return {
      type: 'bulletList',
      content: listItems
    }
  }

  // Ordered list
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
    return {
      type: 'orderedList',
      content: listItems
    }
  }

  return null
}

/**
 * Converts a section to ProseMirror H1 node
 */
function sectionToProseMirror(section: any): any {
  const contentWrapperContent: any[] = []

  // Process section contents
  if (Array.isArray(section.contents)) {
    for (const item of section.contents) {
      const node = contentToProseMirror(item)
      if (node) {
        contentWrapperContent.push(node)
      }
    }
  }

  // If no content, add empty paragraph
  if (contentWrapperContent.length === 0) {
    contentWrapperContent.push({
      type: TIPTAP_NODES.PARAGRAPH_TYPE,
      content: []
    })
  }

  return {
    type: TIPTAP_NODES.HEADING_TYPE,
    attrs: { level: 1, id: uuidv4() },
    content: [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level: 1 },
        content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: section.title || 'Untitled Section' }]
      },
      {
        type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
        content: contentWrapperContent
      }
    ]
  }
}

/**
 * Fast document creation using direct insertContent
 * No typing simulation - instant insertion
 */
export const createDocumentFromStructure = ({ editor }: { editor: Editor }) => {
  return (structure: any) => {
    if (!editor || !editor.commands) return false

    if (!structure.sections || !Array.isArray(structure.sections)) {
      console.error('Invalid document structure: missing sections array')
      return false
    }

    // Build complete document content
    const content = structure.sections.map(sectionToProseMirror)

    try {
      if (content.length > 0) {
        // Use setContent to replace entire document (not clearContent + insertContent)
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
