// The Quickstart from the package README, unchanged.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Mermaid } from '@docs.plus/extension-mermaid'
import '@docs.plus/extension-mermaid/styles.css'

// The page needs <div id="editor"></div> and `color-scheme: light dark`.
const editor = new Editor({ extensions: [StarterKit, Mermaid] })
editor.mount(document.querySelector('#editor')!)
editor.commands.setContent(
  '<pre><code class="language-mermaid">flowchart LR\n  A[Write] --> B[See it]</code></pre>'
)
