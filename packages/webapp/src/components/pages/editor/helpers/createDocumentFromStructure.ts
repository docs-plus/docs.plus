import { Editor } from '@tiptap/core'

export const createDocumentFromStructure = ({ editor }: { editor: Editor }) => {
  return (structure: any) => {
    if (!editor || !editor.commands) return false

    // Clear editor
    editor.commands.clearContent()

    if (!structure.sections || !Array.isArray(structure.sections)) {
      console.error('Invalid document structure: missing sections array')
      return false
    }

    // Build a complete document content array
    const content = structure.sections.map((section: any) => {
      // Create heading node for section title
      const sectionNode = {
        type: 'heading',
        attrs: { level: 1 },
        content: [
          {
            type: 'contentHeading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: section.title || 'Untitled Section' }]
          },
          {
            type: 'contentWrapper',
            content: []
          }
        ]
      }

      // Process section contents
      if (Array.isArray(section.contents)) {
        // Get reference to the contentWrapper where paragraphs will go
        const contentWrapper = sectionNode.content[1].content

        // Add each content item to the wrapper
        section.contents.forEach((item: any) => {
          if (item.type === 'paragraph') {
            // @ts-ignore
            contentWrapper.push({
              type: 'paragraph',
              content: [{ type: 'text', text: item.content || ' ' }]
            })
          }
          // Add handling for other content types as needed
        })
      }

      return sectionNode
    })

    // console.log('Inserting content:', JSON.stringify(content, null, 2))

    try {
      // Insert the complete document structure
      if (content.length > 0) {
        editor.commands.insertContent(content)
        return true
      }
      return false
    } catch (err) {
      console.error('Error inserting content:', err)

      return false
    }
  }
}
