import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { DEFAULT_LIMITS, MERMAID_LANGUAGE } from './constants'
import { createMermaidNodeView } from './nodeView/createMermaidNodeView'
import { createFolds } from './nodeView/fold'
import type { MermaidOptions, MermaidStorage } from './types'

const MERMAID_PLUGIN_KEY = new PluginKey('mermaid')

// The package build has no Node types. The app's bundler replaces `process.env.NODE_ENV`.
declare const process: { env: { NODE_ENV?: string } } | undefined

// The same check as Tiptap's internal `isDev`, so an app bundler drops the warning in production.
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

const OWNER_WARNING =
  '[extension-mermaid] Another node view owns codeBlock, so diagrams do not draw. Use mermaidNodeView in that view: ' +
  'https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/guide.md#keep-your-own-code-block-view'

const STARTER = [
  'flowchart TD',
  '  A[Start] --> B{Ready?}',
  '  B -- Yes --> C[Done]',
  '  B -- No --> A'
].join('\n')

export const Mermaid = Extension.create<MermaidOptions, MermaidStorage>({
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

  // `mermaidNodeView` and the plugin share one fold state; whichever runs first creates it.
  addStorage() {
    return { folds: null, factoryUsed: false, warned: false }
  },

  // A plugin prop ranks below the editor's own node views. A host `codeBlock` with
  // `addNodeView` therefore wins, and the diagram never draws unless that view uses `mermaidNodeView`.
  addProseMirrorPlugins() {
    const storage = this.storage
    const folds = (storage.folds ??= createFolds(this.options))
    const codeBlock = createMermaidNodeView(this.editor, this.options, folds)
    // Storage outlives the plugin view, which is built again whenever the plugin set changes.
    const checkOwner = (view: EditorView): void => {
      if (!isDev || storage.warned || storage.factoryUsed) return
      if (view.someProp('nodeViews', (views) => views.codeBlock) === codeBlock) return
      storage.warned = true
      console.warn(OWNER_WARNING)
    }
    return [
      new Plugin({
        key: MERMAID_PLUGIN_KEY,
        view: (view) => {
          const inner = folds.view()
          checkOwner(view)
          return {
            update(next, prev) {
              checkOwner(next)
              inner.update?.(next, prev)
            }
          }
        },
        props: {
          nodeViews: { codeBlock },
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
