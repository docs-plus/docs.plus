import type { Editor } from '@tiptap/core'

export function clearFormatting(editor: Editor): void {
  try {
    const { selection } = editor.state

    if (!selection.empty) {
      editor.chain().focus().unsetAllMarks().run()
      return
    }

    const cleared = editor.chain().focus().clearNodes().run()
    if (!cleared) {
      editor.chain().focus().unsetAllMarks().run()
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[clearFormatting]', error)
    }
    editor.chain().focus().unsetAllMarks().run()
  }
}
