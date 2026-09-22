// The Quickstart from the package README, unchanged.
import './style.css'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { InlineCode } from '@docs.plus/extension-inline-code'

const editor = new Editor({
  extensions: [
    // StarterKit's `code` mark claims the same `<code>` tag and the same
    // `Mod-e` key. Turn it off, or the document carries two code marks.
    StarterKit.configure({ code: false }),
    InlineCode
  ]
})

editor.mount(document.querySelector('#editor')!)
editor.commands.setContent('<p>Call <code>render()</code> first.</p>')
