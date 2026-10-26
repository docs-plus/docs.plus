import '@docs.plus/extension-mermaid/styles.css'

import { Mermaid, type MermaidOptions, type MermaidView } from '@docs.plus/extension-mermaid'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor, Extension, type Extensions } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import { Plugin } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
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

// A plain code block view with a test id. Its strict `update` hands a language change back to ProseMirror.
function testCodeBlockView(testid: string, node: { attrs: Record<string, unknown> }): NodeView {
  const dom = document.createElement('pre')
  dom.dataset.testid = testid
  const contentDOM = document.createElement('code')
  dom.append(contentDOM)
  const language = node.attrs.language
  return {
    dom,
    contentDOM,
    update: (next) => next.type.name === 'codeBlock' && next.attrs.language === language
  }
}

// `?lower=plugin`: another plugin's `nodeViews.codeBlock`, listed before Mermaid so ours ranks first.
// `?lower=plugin-first`: the same plugin listed after Mermaid, so it ranks first and hides ours.
const LowerView = Extension.create({
  name: 'lowerView',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: { nodeViews: { codeBlock: (node) => testCodeBlockView('lower-view', node) } }
      })
    ]
  }
})

const lower = params.get('lower')
const mermaid = Mermaid.configure(options)
const extensions: Extensions = [StarterKit, Markdown.configure()]
if (lower === 'plugin') extensions.push(LowerView, mermaid)
else if (lower === 'plugin-first') extensions.push(mermaid, LowerView)
else extensions.push(mermaid)

const editor = new Editor({ element, extensions })

if (params.has('readonly')) editor.setEditable(false)

window._editor = editor
window._getMarkdown = () => editor.getMarkdown()
window._parseMarkdown = (md: string) => editor.markdown?.parse(md)
