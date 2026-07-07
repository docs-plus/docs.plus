/** Cypress clean-room for @docs.plus/extension-indent (shipped dist). `?contexts=none` disables literal indent; `?enabled=off` disables the extension. */

import { Indent } from '@docs.plus/extension-indent'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const element = setupPlayground({
  title: '@docs.plus/extension-indent — clean-room playground',
  github: 'extension-indent'
})

const params = new URLSearchParams(window.location.search)
const disableLiteralIndent = params.get('contexts') === 'none'
const disableExtension = params.get('enabled') === 'off'

const editor = new Editor({
  element,
  extensions: [
    StarterKit,
    Indent.configure({
      ...(disableLiteralIndent ? { allowedIndentContexts: [] } : {}),
      ...(disableExtension ? { enabled: false } : {})
    })
  ],
  content: '<p>Press Tab to indent.</p>'
})

declare global {
  interface Window {
    _editor: Editor
  }
}

window._editor = editor
