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
// Awaits each probe so multi-image pastes insert in clipboard order.
const insertPastedImage = (file: File): Promise<void> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const probe = new Image()
    const insert = (dims?: { width: number; height: number }) => {
      editor.commands.setImage({ src: objectUrl, alt: file.name || 'Pasted image', ...dims })
      // `setImage` leaves a NodeSelection on the new image, so the next insert
      // would replace it. Collapse past it before the next file.
      editor.commands.setTextSelection(editor.state.doc.content.size)
      resolve()
    }
    probe.onload = () => insert({ width: probe.naturalWidth, height: probe.naturalHeight })
    probe.onerror = () => insert()
    probe.src = objectUrl
  })

document.addEventListener('editorFileUpload', (event) => {
  if (!(event instanceof CustomEvent)) return
  const { files, editor: eventEditor } = event.detail as { files?: File[]; editor?: Editor }
  if (eventEditor !== editor || !files?.length) return

  void (async () => {
    for (const file of files) {
      if (file.type.startsWith('image/')) await insertPastedImage(file)
    }
  })()
})
