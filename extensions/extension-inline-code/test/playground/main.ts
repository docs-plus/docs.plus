import { InlineCode } from '@docs.plus/extension-inline-code'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
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
// textblock (blockquote/list) can sit at the absolute document end. The
// arrow-exit specs need that trap to be constructible.
const trailingNode = params.get('trailingNode') !== 'off'
// `?markdown=on` loads @tiptap/markdown for the round-trip spec. Off by default:
// it registers a text/plain paste path that would shadow the paste-rule specs.
const markdown = params.get('markdown') === 'on'

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({
      ...(starterkitCode ? {} : { code: false }),
      ...(trailingNode ? {} : { trailingNode: false })
    }),
    ...(markdown ? [Markdown.configure()] : []),
    InlineCode
  ],
  content: '<p>Wrap text in backticks for inline code.</p>'
})

declare global {
  interface Window {
    _editor: Editor
    _getMarkdown?: () => string
    _parseMarkdown?: (md: string) => Record<string, unknown> | undefined
  }
}

window._editor = editor
if (markdown) {
  window._getMarkdown = () => editor.getMarkdown()
  window._parseMarkdown = (md: string) => editor.markdown?.parse(md)
}
