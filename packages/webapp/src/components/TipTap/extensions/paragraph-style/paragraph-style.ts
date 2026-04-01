import type { CommandProps } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'

export const ParagraphStyle = Paragraph.extend({
  name: 'paragraph',

  addAttributes() {
    return {
      ...this.parent?.(),
      paragraphStyle: {
        default: null as null | 'subtitle',
        parseHTML: (element) =>
          element.getAttribute('data-paragraph-style') === 'subtitle' ? 'subtitle' : null,
        renderHTML: (attributes) => {
          if (attributes.paragraphStyle !== 'subtitle') return {}
          return { 'data-paragraph-style': 'subtitle' }
        }
      }
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setParagraphStyle:
        (style: 'normal' | 'subtitle') =>
        ({ chain, editor }: CommandProps) => {
          if (style === 'subtitle') {
            if (editor.isActive('paragraph') && !editor.isActive('heading')) {
              return chain()
                .focus()
                .updateAttributes('paragraph', { paragraphStyle: 'subtitle' })
                .run()
            }
            return chain()
              .focus()
              .setParagraph()
              .updateAttributes('paragraph', { paragraphStyle: 'subtitle' })
              .run()
          }
          if (editor.isActive('paragraph')) {
            return chain().focus().updateAttributes('paragraph', { paragraphStyle: null }).run()
          }
          return chain().focus().setParagraph().run()
        }
    }
  }
})
