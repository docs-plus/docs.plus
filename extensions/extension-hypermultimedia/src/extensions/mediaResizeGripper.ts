import { Extension } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

import { buildOptimizedDecorations } from './decoration'
import { abortActiveGripperDrag } from './decoration/gripperDrag'
import {
  BuildDecorationsFunction,
  HIDE_RESIZE_GRIPPER_META,
  transactionAffectsTrackedNodes
} from './decorationHelpers'

export interface MediaResizeGripperOptions {
  acceptedNodes: string[]
}

export const MediaResizeGripper = Extension.create<MediaResizeGripperOptions>({
  name: 'MediaResizeGripper',

  addOptions() {
    return {
      acceptedNodes: ['image']
    }
  },

  addProseMirrorPlugins() {
    const { acceptedNodes } = this.options
    const editor = this.editor

    const buildDecorations: BuildDecorationsFunction = (doc: ProseMirrorNode) => {
      return buildOptimizedDecorations(acceptedNodes, doc, editor)
    }

    const key = new PluginKey<DecorationSet>('MediaResizeGripper')

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, { doc }) => buildDecorations(doc),
          apply: (tr, old) => {
            // The meta check must stay ahead of the structural scan: an attr
            // commit ships only an AttrStep, which that scan skips by design.
            if (
              tr.getMeta(HIDE_RESIZE_GRIPPER_META) !== undefined ||
              transactionAffectsTrackedNodes(tr, acceptedNodes)
            ) {
              return buildDecorations(tr.doc)
            }
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old
          }
        },
        props: {
          decorations(state) {
            return key.getState(state)
          }
        },
        // Editor torn down mid-drag would otherwise leak the drag's window/
        // document listeners + pointer capture; abort releases them.
        view: () => ({ destroy: () => abortActiveGripperDrag(editor) })
      })
    ]
  }
})
