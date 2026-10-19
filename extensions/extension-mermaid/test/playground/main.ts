import '@docs.plus/extension-mermaid/styles.css'

import { Mermaid, type MermaidOptions, type MermaidView } from '@docs.plus/extension-mermaid'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'

const element = setupPlayground({
  title: '@docs.plus/extension-mermaid — clean-room playground',
  github: 'extension-mermaid'
})

const params = new URLSearchParams(window.location.search)

declare global {
  interface Window {
    _editor: Editor
    _getMarkdown: () => string
    _parseMarkdown: (md: string) => Record<string, unknown> | undefined
    _customViews: HTMLElement[]
  }
}

window._customViews = []

// A host view that styles nothing: the specs read its test ids and its destroy mark.
function createCustomView(): MermaidView {
  const dom = document.createElement('div')
  dom.dataset.testid = 'custom-view'

  const label = document.createElement('span')
  label.dataset.testid = 'custom-label'
  label.textContent = 'Custom view'

  const state = document.createElement('span')
  state.dataset.testid = 'custom-state'

  const diagram = document.createElement('div')
  diagram.dataset.testid = 'custom-diagram'

  dom.append(label, state, diagram)
  window._customViews.push(dom)

  return {
    dom,
    diagram,
    update(snapshot) {
      state.textContent = snapshot.state
    },
    destroy() {
      dom.dataset.destroyed = 'true'
    }
  }
}

const options: Partial<MermaidOptions> = {}
if (params.get('view') === 'custom') options.view = createCustomView
else if (params.has('bare')) Object.assign(options, { fold: false, helpLink: false, copy: false })

const editor = new Editor({
  element,
  extensions: [StarterKit, Markdown.configure(), Mermaid.configure(options)]
})

if (params.has('readonly')) editor.setEditable(false)

window._editor = editor
window._getMarkdown = () => editor.getMarkdown()
window._parseMarkdown = (md: string) => editor.markdown?.parse(md)
