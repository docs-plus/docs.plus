import { Extension } from '@tiptap/core'

import { createMarkdownPastePlugin } from './markdownPastePlugin'

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [createMarkdownPastePlugin(this.editor)]
  }
})
