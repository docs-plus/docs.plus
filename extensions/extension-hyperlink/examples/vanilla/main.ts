// The Quickstart from the package README, unchanged.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  Hyperlink,
  createHyperlinkPopover,
  editHyperlinkPopover,
  previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'
import '@docs.plus/extension-hyperlink/styles.css'

const editor = new Editor({
  element: document.querySelector('#editor'),
  content: '<p>Try <a href="https://example.com">this link</a>.</p>',
  extensions: [
    // Disable StarterKit's bundled link mark — see Caveats.
    StarterKit.configure({ link: false }),
    Hyperlink.configure({
      popovers: {
        previewHyperlink: previewHyperlinkPopover,
        editHyperlink: editHyperlinkPopover,
        createHyperlink: createHyperlinkPopover
      }
    })
  ]
})
