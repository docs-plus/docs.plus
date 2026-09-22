// The Quickstart from the package README, unchanged.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Indent } from '@docs.plus/extension-indent'

const editor = new Editor({
  // Your page must already hold this element, or the editor never mounts.
  element: document.querySelector('#editor'),
  content: '<p>Press Tab at the start of this line.</p>',
  extensions: [
    StarterKit,
    Indent.configure({
      // This array replaces the default allowlist, so list every rule you keep.
      allowedIndentContexts: [
        { textblock: 'paragraph', parent: 'doc' },
        { textblock: 'paragraph', parent: 'blockquote' },
        { textblock: 'heading', parent: 'doc' }
      ]
    })
  ]
})
