// The Quickstart from the package README, unchanged.
import './style.css'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@docs.plus/extension-placeholder'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  extensions: [
    StarterKit,
    // StarterKit does not include a placeholder extension.
    // If your array already holds Tiptap's built-in Placeholder, remove it.
    // Register one placeholder extension, never both.
    Placeholder.configure({
      placeholder: 'Write something …'
    })
  ]
})
