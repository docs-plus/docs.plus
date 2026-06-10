/**
 * Cypress clean-room for @docs.plus/extension-placeholder (shipped dist). Query params:
 * `?editable=false`, `?showOnlyWhenEditable=false`, `?placeholder=fn|empty`, `?nodeClass=custom`.
 */

import { Placeholder, type PlaceholderRenderProps } from '@docs.plus/extension-placeholder'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const element = setupPlayground({
  title: '@docs.plus/extension-placeholder — clean-room playground',
  github: 'extension-placeholder'
})

// The package ships no CSS; render the decoration text so Cypress can read it.
// Injected inline because the playground only symlinks main.ts (a sibling CSS
// import would not resolve).
const style = document.createElement('style')
style.textContent =
  '.ProseMirror [data-placeholder]::before{content:attr(data-placeholder);color:#9ca3af;float:left;height:0;pointer-events:none}'
document.head.appendChild(style)

const params = new URLSearchParams(window.location.search)
const editable = params.get('editable') !== 'false'
const showOnlyWhenEditable = params.get('showOnlyWhenEditable') !== 'false'
const placeholderMode = params.get('placeholder')
const customClasses = params.get('nodeClass') === 'custom'

function placeholderOption(): string | ((props: PlaceholderRenderProps) => string) {
  if (placeholderMode === 'empty') return ''
  if (placeholderMode === 'fn') {
    return ({ node, parentName }) => {
      if (node.type.name === 'heading') return 'Untitled'
      return parentName === 'listItem' ? 'List item' : `Empty ${parentName}`
    }
  }
  return 'Write something here'
}

const editor = new Editor({
  element,
  editable,
  extensions: [
    StarterKit,
    Placeholder.configure({
      showOnlyWhenEditable,
      placeholder: placeholderOption(),
      ...(customClasses && { emptyNodeClass: 'ph-node', emptyEditorClass: 'ph-doc' })
    })
  ],
  content: ''
})

declare global {
  interface Window {
    _editor: Editor
  }
}

window._editor = editor
