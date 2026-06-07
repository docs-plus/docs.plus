/** Cypress clean-room: shipped dist + window._editor / window._hypermultimedia. */

import { Hyperlink } from '@docs.plus/extension-hyperlink'
import * as HyperMultimediaModule from '@docs.plus/extension-hypermultimedia'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const { HyperMultimediaKit, isMediaUrl } = HyperMultimediaModule

const element = document.querySelector<HTMLElement>('#editor')
if (!element) throw new Error('#editor mount point missing')

const loadingShellParam = new URLSearchParams(window.location.search).get('loadingShell')
const loadingShell = loadingShellParam === 'false' ? false : true
const uploadedParam = new URLSearchParams(window.location.search).get('uploaded') === 'true'

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({ link: false }),
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
  }
}

window._editor = editor
window._hypermultimedia = HyperMultimediaModule

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
