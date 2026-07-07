/** Cypress clean-room: shipped dist + window._editor / window._hypermultimedia. */

import '@docs.plus/extension-hypermultimedia/styles.css'

import { Hyperlink } from '@docs.plus/extension-hyperlink'
import * as HyperMultimediaModule from '@docs.plus/extension-hypermultimedia'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'

const { HyperMultimediaKit, isMediaUrl } = HyperMultimediaModule

// No token map: the shipped styles.css themes itself via light-dark() and the
// shell's `color-scheme` toggle.
const element = setupPlayground({
  title: '@docs.plus/extension-hypermultimedia — clean-room playground',
  github: 'extension-hypermultimedia'
})

const params = new URLSearchParams(window.location.search)
const loadingShell = params.get('loadingShell') !== 'false'
const uploadedParam = params.get('uploaded') === 'true'
// `?blockquote=off` removes StarterKit's blockquote so specs can assert rejected
// twitter-tweet markup falls through to nothing instead of a blockquote node.
const blockquoteOff = params.get('blockquote') === 'off'

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({ link: false, ...(blockquoteOff ? { blockquote: false } : {}) }),
    Markdown.configure(),
    Hyperlink.configure({
      autolink: true,
      linkOnPaste: false,
      shouldAutoLink: (url: string) => !isMediaUrl(url)
    }),
    HyperMultimediaKit.configure({
      Image: { inline: false },
      Video: true,
      Audio: true,
      Youtube: true,
      Vimeo: true,
      SoundCloud: true,
      Spotify: true,
      Loom: true,
      X: true,
      loadingShell,
      isUploadedMedia: () => uploadedParam
    })
  ],
  content:
    '<p>Media playground — use <code>window._editor.commands</code> or Cypress helpers to insert media nodes.</p>'
})

declare global {
  interface Window {
    _editor: Editor
    _hypermultimedia: typeof HyperMultimediaModule
    _getMarkdown?: () => string
    _parseMarkdown?: (md: string) => Record<string, unknown> | undefined
  }
}

window._editor = editor
window._hypermultimedia = HyperMultimediaModule
window._getMarkdown = () => editor.getMarkdown()
window._parseMarkdown = (md: string) => editor.markdown?.parse(md)

// Hosts handle `editorFileUpload`; playground inserts via blob URL (no backend).
document.addEventListener('editorFileUpload', (event) => {
  if (!(event instanceof CustomEvent)) return
  const { file, editor: eventEditor } = event.detail as { file?: File; editor?: Editor }
  if (eventEditor !== editor || !file?.type.startsWith('image/')) return

  const objectUrl = URL.createObjectURL(file)
  const probe = new Image()
  probe.onload = () => {
    editor.commands.setImage({
      src: objectUrl,
      alt: file.name || 'Pasted image',
      width: probe.naturalWidth,
      height: probe.naturalHeight
    })
  }
  probe.onerror = () => {
    editor.commands.setImage({ src: objectUrl, alt: file.name || 'Pasted image' })
  }
  probe.src = objectUrl
})
