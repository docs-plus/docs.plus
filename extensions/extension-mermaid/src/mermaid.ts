import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'

import { DEFAULT_LIMITS, MERMAID_LANGUAGE } from './constants'
import { createMermaidNodeView } from './nodeView/createMermaidNodeView'
import { createFolds } from './nodeView/fold'
import type { MermaidOptions } from './types'

const MERMAID_PLUGIN_KEY = new PluginKey('mermaid')

const STARTER = [
  'flowchart TD',
  '  A[Start] --> B{Ready?}',
  '  B -- Yes --> C[Done]',
  '  B -- No --> A'
].join('\n')

export const Mermaid = Extension.create<MermaidOptions>({
  name: 'mermaid',

  addOptions() {
    return {
      theme: null,
      view: null,
      sanitize: null,
      images: false,
      zoom: 'auto',
      limits: { ...DEFAULT_LIMITS },
      fold: { initial: 'folded-when-read-only', remember: true },
      helpLink: 'https://mermaid.js.org/intro/syntax-reference.html',
      copy: true,
      HTMLAttributes: {},
      onStateChange: null
    }
  },

  // A plugin prop ranks below the editor's own node views. A host `codeBlock` with
  // `addNodeView` therefore wins, and the diagram never draws.
  addProseMirrorPlugins() {
    const folds = createFolds(this.options)
    return [
      new Plugin({
        key: MERMAID_PLUGIN_KEY,
        view: folds.view,
        props: {
          nodeViews: { codeBlock: createMermaidNodeView(this.editor, this.options, folds) },
          handleKeyDown: folds.handleKeyDown
        }
      })
    ]
  },

  addCommands() {
    return {
      insertMermaid:
        (source) =>
        ({ state, tr, dispatch, commands }) => {
          const type = state.schema.nodes.codeBlock
          if (!type || state.selection.$from.parent.type.spec.code) return false
          if (!dispatch) return true

          const text = source ?? STARTER
          const steps = tr.steps.length
          // `Transform.replace` adds no step when the block cannot fit, yet `insertContent`
          // still returns true. Nested commands share `tr`, so the step count shows it.
          if (
            !commands.insertContent({
              type: 'codeBlock',
              attrs: { language: MERMAID_LANGUAGE },
              content: text ? [{ type: 'text', text }] : []
            }) ||
            tr.steps.length === steps
          ) {
            return false
          }

          // After a mid-paragraph split, or an insert at the start of a non-empty paragraph,
          // `insertContent` leaves the caret in the following paragraph. Stepping back over its
          // open token and the block close token lands at the end of the source.
          if (tr.selection.$from.parent.type !== type) {
            tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, tr.selection.from - 2))))
          }
          return true
        }
    }
  }
})
