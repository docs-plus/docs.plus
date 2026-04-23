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
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // ProseMirror's default splitBlock copies all parent attributes onto the
      // new block, so pressing Enter inside a subtitle would inherit
      // `paragraphStyle: 'subtitle'`. Mirror Google Docs / Word: at the END of
      // a subtitle, Enter starts a fresh normal paragraph. Mid-paragraph and
      // at-start splits keep the inherited style (so the user can split a
      // subtitle in two without losing the style).
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const node = $from.parent
        if (node.type.name !== 'paragraph') return false
        if (node.attrs.paragraphStyle !== 'subtitle') return false
        const atEnd = $from.parentOffset === node.content.size
        if (!atEnd) return false
        return editor
          .chain()
          .splitBlock()
          .updateAttributes('paragraph', { paragraphStyle: null })
          .run()
      }
    }
  }
})
