// The Quickstart from the package README, unchanged.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
// Required. Without it the toolbar, gripper, caption and loading shell render unstyled.
import '@docs.plus/extension-hypermultimedia/styles.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  // One image, then an empty paragraph to paste into.
  content:
    '<img src="https://docs.plus/demo-assets/extensions__extension-hypermultimedia__assets__image-light.png"><p></p>',
  // No `configure` call: all nine nodes load with their defaults.
  extensions: [StarterKit, HyperMultimediaKit]
})
