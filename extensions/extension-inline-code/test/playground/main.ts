/** Cypress clean-room for @docs.plus/extension-inline-code (shipped dist). */

import { InlineCode } from '@docs.plus/extension-inline-code'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const element = setupPlayground({
  title: '@docs.plus/extension-inline-code — clean-room playground',
  github: 'extension-inline-code'
})

const params = new URLSearchParams(window.location.search)
// Default disables StarterKit's `code` mark (it collides with InlineCode on the
// `<code>` tag + Mod-e). `?starterkitCode=on` re-enables it to verify InlineCode's
// higher priority wins the collision (see README).
const starterkitCode = params.get('starterkitCode') === 'on'
// `?trailingNode=off` drops StarterKit's trailing paragraph so a nested last
// textblock (blockquote/list) can sit at the absolute document end — the
// arrow-exit specs need that trap to be constructible.
const trailingNode = params.get('trailingNode') !== 'off'

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({
      ...(starterkitCode ? {} : { code: false }),
      ...(trailingNode ? {} : { trailingNode: false })
    }),
    InlineCode
  ],
  content: '<p>Wrap text in backticks for inline code.</p>'
})

declare global {
  interface Window {
    _editor: Editor
  }
}

window._editor = editor
